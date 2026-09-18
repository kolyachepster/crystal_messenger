from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from fastapi import WebSocket, WebSocketDisconnect

from sqlalchemy.orm import Session

from backend.database import engine, Base, get_db
from backend import models
from backend.schemas import (
    UserCreate,
    UserResponse,
    LoginRequest,
    TokenResponse,
    MessageCreate,
    MessageResponse,
    GroupCreate,
    GroupResponse,
    GroupMessageCreate,
    GroupMessageResponse
)
from backend.auth import (
    hash_password,
    verify_password,
    create_token
)
from backend.dependencies import get_current_user

from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse


class ConnectionManager:

    def __init__(self):
        self.active_connections = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_to_user(self, user_id: int, data):
        websocket = self.active_connections.get(user_id)

        print(f"📡 send_to_user: user_id={user_id}")
        print(f"📡 active_connections={self.active_connections.keys()}")

        if websocket:
            print(f"✅ WS найден для пользователя {user_id}")

            try:
                await websocket.send_json(data)
                print(f"✅ Сообщение отправлено пользователю {user_id}")

            except Exception as e:
                print(f"❌ Ошибка отправки WS: {e}")
                self.disconnect(user_id)

        else:
            print(f"⚠️ Пользователь {user_id} НЕ подключен к WebSocket")

manager = ConnectionManager()

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Crystal Messenger")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "Crystal Messenger API работает 🚀"
    }

app.mount(
    "/frontend",
    StaticFiles(directory="frontend"),
    name="frontend"
)

@app.get("/chat")
def chat():
    return FileResponse("frontend/chat.html")

@app.get("/login-page")
def login_page():
    return FileResponse("frontend/login.html")

@app.get("/register-page")
def register_page():
    return FileResponse("frontend/register.html")

@app.post("/register", response_model=UserResponse)
def register(
    user: UserCreate,
    db: Session = Depends(get_db)
):
    existing_user = db.query(models.User).filter(
        models.User.email == user.email
    ).first()

    if existing_user:
        return {
            "error": "Пользователь с таким email уже существует"
        }

    new_user = models.User(
    email=user.email,
    username=user.username,
    password=hash_password(user.password)
)

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user

from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm

from sqlalchemy.orm import Session

from backend import models
from backend.database import get_db
from backend.auth import verify_password, create_token


@app.post("/login", response_model=TokenResponse)
def login(
    data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):

    user = db.query(models.User).filter(
        models.User.email == data.username
    ).first()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Неверные данные"
        )

    if not verify_password(
        data.password,
        user.password
    ):
        raise HTTPException(
            status_code=401,
            detail="Неверные данные"
        )

    token = create_token({
        "user_id": user.id
    })

    return {
        "access_token": token,
        "token_type": "bearer"
    }
#eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJleHAiOjE3ODM5NjYyMjF9.yRmvME7258P0b7KgcCWjmSjjekCs5i4E83eil09s5cU



@app.post("/messages", response_model=MessageResponse)
async def send_message(
    message: MessageCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    new_message = models.Message(
        sender_id=current_user.id,
        receiver_id=message.receiver_id,
        text=message.text
    )

    db.add(new_message)
    db.commit()
    db.refresh(new_message)

    message_data = {
        "id": new_message.id,
        "sender_id": new_message.sender_id,
        "receiver_id": new_message.receiver_id,
        "text": new_message.text,
        "created_at": new_message.created_at.isoformat()
    }

    print("📤 Отправляем через WS:", message_data)
    print("👥 Подключения:", manager.active_connections.keys())

    await manager.send_to_user(
        message.receiver_id,
        message_data
    )

    # Отправляем сообщение и самому отправителю
    await manager.send_to_user(
        current_user.id,
        message_data
    )

    return new_message

@app.get("/messages/{user_id}", response_model=list[MessageResponse])
def get_messages(
    user_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    messages = db.query(models.Message).filter(
        (
            (models.Message.sender_id == current_user.id) &
            (models.Message.receiver_id == user_id)
        ) |
        (
            (models.Message.sender_id == user_id) &
            (models.Message.receiver_id == current_user.id)
        )
    ).order_by(models.Message.created_at).all()

    return messages

@app.get("/users")
def get_users(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    users = db.query(models.User).filter(
        models.User.id != current_user.id
    ).all()

    return users

@app.post("/groups", response_model=GroupResponse)
def create_group(
    group: GroupCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Создаём группу
    new_group = models.Group(
        name=group.name,
        owner_id=current_user.id
    )

    db.add(new_group)
    db.commit()
    db.refresh(new_group)

    # Создатель автоматически становится участником
    owner_member = models.GroupMember(
        group_id=new_group.id,
        user_id=current_user.id
    )

    db.add(owner_member)

    # Добавляем выбранных пользователей
    for user_id in group.member_ids:

        # Не добавляем создателя второй раз
        if user_id == current_user.id:
            continue

        user = db.query(models.User).filter(
            models.User.id == user_id
        ).first()

        if user:
            member = models.GroupMember(
                group_id=new_group.id,
                user_id=user.id
            )

            db.add(member)

    db.commit()

    return new_group

@app.get("/groups", response_model=list[GroupResponse])
def get_groups(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    groups = (
        db.query(models.Group)
        .join(models.GroupMember)
        .filter(
            models.GroupMember.user_id == current_user.id
        )
        .all()
    )

    return groups

@app.get("/groups/{group_id}/members")
def get_group_members(
    group_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Проверяем, состоит ли пользователь в группе
    membership = db.query(models.GroupMember).filter(
        models.GroupMember.group_id == group_id,
        models.GroupMember.user_id == current_user.id
    ).first()

    if not membership:
        raise HTTPException(
            status_code=403,
            detail="Вы не состоите в этой группе"
        )

    members = (
        db.query(models.User)
        .join(models.GroupMember)
        .filter(
            models.GroupMember.group_id == group_id
        )
        .all()
    )

    return members

@app.get(
    "/groups/{group_id}/messages",
    response_model=list[GroupMessageResponse]
)
def get_group_messages(
    group_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Проверяем, состоит ли пользователь в группе
    membership = db.query(models.GroupMember).filter(
        models.GroupMember.group_id == group_id,
        models.GroupMember.user_id == current_user.id
    ).first()

    if not membership:
        raise HTTPException(
            status_code=403,
            detail="Вы не состоите в этой группе"
        )

    messages = (
        db.query(models.GroupMessage)
        .filter(
            models.GroupMessage.group_id == group_id
        )
        .order_by(
            models.GroupMessage.created_at
        )
        .all()
    )

    return messages

@app.post(
    "/groups/{group_id}/messages",
    response_model=GroupMessageResponse
)
async def send_group_message(
    group_id: int,
    message: GroupMessageCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Проверяем участника
    membership = db.query(models.GroupMember).filter(
        models.GroupMember.group_id == group_id,
        models.GroupMember.user_id == current_user.id
    ).first()

    if not membership:
        raise HTTPException(
            status_code=403,
            detail="Вы не состоите в этой группе"
        )

    # Создаём сообщение
    new_message = models.GroupMessage(
        group_id=group_id,
        sender_id=current_user.id,
        text=message.text
    )

    db.add(new_message)
    db.commit()
    db.refresh(new_message)

    # Данные для WebSocket
    message_data = {
        "id": new_message.id,
        "group_id": new_message.group_id,
        "sender_id": new_message.sender_id,
        "text": new_message.text,
        "created_at": new_message.created_at.isoformat()
    }

    # Получаем участников группы
    members = (
        db.query(models.GroupMember)
        .filter(
            models.GroupMember.group_id == group_id
        )
        .all()
    )

    # Отправляем сообщение всем участникам
    for member in members:

        await manager.send_to_user(
            member.user_id,
            message_data
        )

    return new_message

@app.get("/me", response_model=UserResponse)
def get_me(
    current_user: models.User = Depends(get_current_user)
):
    return current_user

@app.get("/test-ws")
def test_ws():
    return {
        "websocket": "route exists",
        "path": "/ws/{user_id}"
    }

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: int
):
    print(f"🔥 WS REQUEST: user_id={user_id}")

    await websocket.accept()

    print(f"✅ WS ACCEPTED: user_id={user_id}")

    manager.active_connections[user_id] = websocket

    try:
        while True:
            data = await websocket.receive_text()
            print(f"📨 WS DATA {user_id}: {data}")

    except WebSocketDisconnect:
        print(f"❌ WS DISCONNECT: user_id={user_id}")
        manager.disconnect(user_id)

    except Exception as e:
        print(f"💥 WS ERROR: {e}")
        manager.disconnect(user_id)

print("\n========== ROUTES ==========")

for route in app.routes:
    print(
        type(route).__name__,
        getattr(route, "path", None),
        getattr(route, "name", None)
    )

print("============================\n")