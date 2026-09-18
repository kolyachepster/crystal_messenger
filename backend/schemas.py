from pydantic import BaseModel, EmailStr
from pydantic import BaseModel
from datetime import datetime

class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    username: str

    class Config:
        from_attributes = True

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str

from datetime import datetime

class MessageCreate(BaseModel):
    receiver_id: int
    text: str

class MessageResponse(BaseModel):
    id: int
    sender_id: int
    receiver_id: int
    text: str
    created_at: datetime

    class Config:
        from_attributes = True

class GroupMessageCreate(BaseModel):
    text: str

class GroupMessageResponse(BaseModel):
    id: int
    group_id: int
    sender_id: int
    text: str
    created_at: datetime

    class Config:
        from_attributes = True

class GroupCreate(BaseModel):
    name: str
    member_ids: list[int]

class GroupResponse(BaseModel):
    id: int
    name: str
    owner_id: int

    class Config:
        from_attributes = True