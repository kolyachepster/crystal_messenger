console.log("bimbimbambam")

const token = localStorage.getItem("token");

let selectedUser = null;
let selectedGroup = null;
let myId = null;
let socket = null;
let currentChatId = null;
let groups = [];

console.log("TOKEN:", token);

if (!token) {
    window.location.href = "/login-page";
}

// =========================
// Получение текущего пользователя
// =========================

async function loadMe() {

    const response = await fetch(`${API_URL}/me`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    if (!response.ok) {
        console.error("Не удалось получить пользователя");
        return;
    }

    const user = await response.json();

    myId = user.id;

    console.log("Мой ID:", myId);

    connectWebSocket();
}

// =========================
// WebSocket
// =========================

function connectWebSocket() {

    if (!myId) {
        console.error("myId ещё не установлен");
        return;
    }

    if (socket) {
        socket.close();
        socket = null;
    }

    socket = new WebSocket(
        `ws://127.0.0.1:8000/ws/${myId}`
    );

    socket.onopen = () => {

        console.log("✅ WebSocket подключен");

    };

    socket.onmessage = (event) => {

        console.log("📨 RAW WS:", event.data);

        const message =
            JSON.parse(event.data);

        console.log(
            "📨 WS MESSAGE:",
            message
        );

        // =========================
        // ГРУППОВОЕ СООБЩЕНИЕ
        // =========================

        if (message.group_id) {

            console.log(
                "👥 Получено сообщение группы:",
                message
            );

            if (
                selectedGroup &&
                Number(message.group_id) === Number(selectedGroup)
            ) {

                addGroupMessageToChat(message);
            }

            return;
        }

        // =========================
        // ЛИЧНОЕ СООБЩЕНИЕ
        // =========================

        if (
            selectedUser &&
            (
                Number(message.sender_id) === Number(selectedUser) ||
                Number(message.receiver_id) === Number(selectedUser)
            )
        ) {

            addMessageToChat(message);
        }
    };

    socket.onclose = () => {

        console.log("❌ WebSocket отключен");

    };

    socket.onerror = (error) => {

        console.error("❌ WebSocket ошибка:", error);

    };

}

// =========================
// Загрузка пользователей
// =========================

async function loadUsers() {

    const response = await fetch(`${API_URL}/users`, {

        headers: {
            Authorization: `Bearer ${token}`
        }

    });

    if (!response.ok) {

        console.error("Ошибка загрузки пользователей");

        return;

    }

    const users = await response.json();

    const container = document.getElementById("users");

    container.innerHTML = "";

    users.forEach(user => {

        const div = document.createElement("div");

        div.className = "user";

        div.id = `user-${user.id}`;

        div.innerHTML = `
            👤 ${user.username}
        `;

        div.onclick = () => {

            openChat(
                user.id,
                user.username
            );

        };

        container.appendChild(div);

    });

}

// =========================
// Загрузка пользователей для создания группы
// =========================

async function loadGroupUsers() {

    const container = document.getElementById("groupUsers");

    if (!container) {
        console.error("❌ Не найден #groupUsers");
        return;
    }

    container.innerHTML = "Загрузка пользователей...";

    try {

        const response = await fetch(`${API_URL}/users`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        console.log("GET /users:", response.status);

        if (!response.ok) {

            const error = await response.text();

            console.error("Ошибка /users:", error);

            container.innerHTML =
                "Не удалось загрузить пользователей";

            return;
        }

        const users = await response.json();

        console.log("Пользователи для группы:", users);

        container.innerHTML = "";

        if (users.length === 0) {

            container.innerHTML =
                "Других пользователей пока нет";

            return;
        }

        users.forEach(user => {

            const label = document.createElement("label");

            label.className = "groupUser";

            label.innerHTML = `
                <input
                    type="checkbox"
                    value="${user.id}"
                >

                <span>
                    👤 ${escapeHtml(user.username)}
                </span>
            `;

            container.appendChild(label);

        });

    } catch (error) {

        console.error(
            "❌ Ошибка загрузки участников:",
            error
        );

        container.innerHTML =
            "Ошибка соединения с сервером";
    }
}
// =========================
// Создание группы — окно
// =========================

const createGroupButton =
    document.getElementById("createGroupButton");

const groupModal =
    document.getElementById("groupModal");

if (createGroupButton) {

    createGroupButton.addEventListener("click", async () => {

        console.log("🟢 Нажата кнопка создания группы");

        groupModal.classList.remove("hidden");

        await loadGroupUsers();

    });

}
if (cancelGroupButton) {

    cancelGroupButton.addEventListener("click", () => {

        groupModal.classList.add("hidden");

    });

}

// =========================
// Создание группы
// =========================

const confirmGroupButton =
    document.getElementById("confirmGroupButton");

if (confirmGroupButton) {

    confirmGroupButton.addEventListener("click", async () => {

        const nameInput =
            document.getElementById("groupName");

        const name =
            nameInput.value.trim();

        if (!name) {

            alert("Введите название группы");

            return;

        }

        // Получаем выбранных пользователей

        const checkboxes =
            document.querySelectorAll(
                "#groupUsers input[type='checkbox']:checked"
            );

        const memberIds =
            Array.from(checkboxes).map(
                checkbox => Number(checkbox.value)
            );

        if (memberIds.length === 0) {

            alert("Выберите хотя бы одного участника");

            return;

        }

        try {

            const response =
                await fetch(`${API_URL}/groups`, {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        Authorization:
                            `Bearer ${token}`

                    },

                    body: JSON.stringify({

                        name: name,

                        member_ids: memberIds

                    })

                });

            if (!response.ok) {

                const error =
                    await response.text();

                console.error(
                    "Ошибка создания группы:",
                    error
                );

                alert("Не удалось создать группу");

                return;

            }

            const group =
                await response.json();

            console.log(
                "Группа создана:",
                group
            );

            // Закрываем окно

            groupModal.classList.add("hidden");

            // Очищаем форму

            nameInput.value = "";

            document
                .querySelectorAll(
                    "#groupUsers input[type='checkbox']"
                )
                .forEach(checkbox => {

                    checkbox.checked = false;

                });

            // Обновляем список групп

            await loadGroups();

        } catch (error) {

            console.error(
                "Ошибка создания группы:",
                error
            );

            alert("Ошибка соединения с сервером");

        }

    });

}

// =========================
// Открытие чата
// =========================

async function openChat(userId, username) {

    console.log("Открыт личный чат:", userId, username);

    selectedUser = Number(userId);
    selectedGroup = null;

    currentChatId = selectedUser;

    document.getElementById("chatHeader").innerText = username;

    document
        .querySelectorAll(".user")
        .forEach(user => {
            user.classList.remove("activeUser");
        });

    const activeUser =
        document.getElementById(`user-${userId}`);

    if (activeUser) {
        activeUser.classList.add("activeUser");
    }

    document.getElementById("messages").innerHTML = "";

    await loadMessages();
}

// =========================
// Загрузка истории сообщений
// =========================

async function loadMessages() {

    if (!selectedUser) {
        return;
    }

    const response = await fetch(
        `${API_URL}/messages/${selectedUser}`,
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    if (!response.ok) {

        console.error(
            "Ошибка загрузки сообщений"
        );

        return;

    }

    const messages = await response.json();

    
    const container = 
        document.getElementById("messages");

    // Очень важно:
    // полностью рисуем историю только здесь,
    // при открытии/смене чата.

    container.innerHTML = "";

    messages.forEach(message => {

        addMessageToChat(
            message,
            false
        );

    });

    container.scrollTop =
        container.scrollHeight;

}

// =========================
// Добавление сообщения на экран
// =========================

function addMessageToChat(
    message,
    scroll = true
) {

    const container =
        document.getElementById("messages");

    // Защита от дублирования

    if (
        message.id &&
        document.querySelector(
            `[data-message-id="${message.id}"]`
        )
    ) {

        return;

    }

    const mine =
        message.sender_id === myId;

    const div =
        document.createElement("div");

    div.className = mine
        ? "myMessage"
        : "friendMessage";

    if (message.id) {

        div.dataset.messageId =
            message.id;

    }

    const date =
        new Date(message.created_at);


    function formatTime(dateString) {
        const date = new Date(
            dateString.endsWith("Z")
                ? dateString
                : dateString + "Z"
        );

        return date.toLocaleTimeString("ru-RU", {
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    div.innerHTML = `
        <div class="text">
            ${escapeHtml(message.text)}
        </div>

        <div class="time">
            ${formatTime(message.created_at)}
        </div>
    `;

    container.appendChild(div);

    if (scroll) {

        container.scrollTop =
            container.scrollHeight;

    }

}

// =========================
// Защита текста
// =========================

function escapeHtml(text) {

    const div =
        document.createElement("div");

    div.textContent = text;

    return div.innerHTML;

}

// =========================
// Отправка сообщения
// =========================

async function sendMessage() {

    const input =
        document.getElementById("messageInput");

    const text =
        input.value.trim();

    if (!text) {
        return;
    }

    // =========================
    // ГРУППОВОЕ СООБЩЕНИЕ
    // =========================

    if (selectedGroup) {

        console.log(
            "📤 Отправляем сообщение в группу:",
            selectedGroup
        );

        const response = await fetch(
            `${API_URL}/groups/${selectedGroup}/messages`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },

                body: JSON.stringify({
                    text: text
                })
            }
        );

        if (!response.ok) {

            console.error(
                "Ошибка отправки сообщения в группу:",
                await response.text()
            );

            return;
        }

        input.value = "";
        input.focus();

        return;
    }

    // =========================
    // ЛИЧНОЕ СООБЩЕНИЕ
    // =========================

    if (!selectedUser) {

        alert("Выберите пользователя");

        return;
    }

    console.log(
        "📤 Отправляем личное сообщение:",
        selectedUser
    );

    try {

        const response = await fetch(
            `${API_URL}/messages`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },

                body: JSON.stringify({
                    receiver_id: selectedUser,
                    text: text
                })
            }
        );

        if (!response.ok) {

            console.error(
                "Ошибка отправки:",
                await response.text()
            );

            return;
        }

        const message =
            await response.json();

        console.log("🕐 ВРЕМЯ ОТ СЕРВЕРА:", message.created_at);
        console.log("🕐 ВРЕМЯ JS:", new Date(message.created_at));
        console.log("🕐 ВРЕМЯ JS + Z:", new Date(message.created_at + "Z"));

        console.log(
            "Сообщение сохранено:",
            message
        );

        input.value = "";
        input.focus();

    } catch (error) {

        console.error(
            "Ошибка отправки сообщения:",
            error
        );
    }
}

// =========================
// Открытие группы
// =========================


async function loadGroups() {

    const response = await fetch(`${API_URL}/groups`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    if (!response.ok) {
        console.error("Ошибка загрузки групп");
        return;
    }

    groups = await response.json();

    const container = document.getElementById("groups");

    if (!container) return;

    container.innerHTML = "";

    groups.forEach(group => {

        const div = document.createElement("div");

        div.className = "user";

        div.innerHTML = `
            👥 ${group.name}
        `;

        div.onclick = () => {

            openGroup(group.id, group.name);

        };

        container.appendChild(div);

    });
}

async function openGroup(groupId, groupName) {

    console.log("Открыта группа:", groupId, groupName);

    selectedUser = null;
    selectedGroup = Number(groupId);

    currentChatId = `group-${groupId}`;

    document.getElementById("chatHeader").innerText =
        `👥 ${groupName}`;

    document
        .querySelectorAll(".user")
        .forEach(user => {
            user.classList.remove("activeUser");
        });

    document.getElementById("messages").innerHTML = "";

    await loadGroupMessages(groupId);

    await loadGroupMembers(groupId);
}

async function loadGroupMessages(groupId) {

    const response = await fetch(
        `${API_URL}/groups/${groupId}/messages`,
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    if (!response.ok) {

        console.error(
            "Ошибка загрузки сообщений группы"
        );

        return;
    }

    const messages = await response.json();

    const container =
        document.getElementById("messages");

    container.innerHTML = "";

    messages.forEach(message => {

        addGroupMessageToChat(
            message,
            false
        );

    });

    container.scrollTop =
        container.scrollHeight;
}

function addGroupMessageToChat(message, scroll = true) {

    const container =
        document.getElementById("messages");

    if (
        message.id &&
        document.querySelector(
            `[data-group-message-id="${message.id}"]`
        )
    ) {
        return;
    }

    const mine =
        Number(message.sender_id) === Number(myId);

    const div =
        document.createElement("div");

    div.className = mine
        ? "myMessage"
        : "friendMessage";

    if (message.id) {

        div.dataset.groupMessageId =
            message.id;
    }

    div.innerHTML = `
        <div class="text">
            ${escapeHtml(message.text)}
        </div>

        ${formatTime(message.created_at)}
        </div>
    `;

    container.appendChild(div);

    if (scroll) {

        container.scrollTop =
            container.scrollHeight;
    }
}

// =========================
// Кнопка отправки
// =========================

document
    .getElementById("sendButton")
    .addEventListener(
        "click",
        sendMessage
    );

// =========================
// Enter
// =========================

document
    .getElementById("messageInput")
    .addEventListener(
        "keydown",
        function(event) {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendMessage();

            }

        }
    );

// =========================
// Запуск
// =========================

(async function init() {

    await loadMe();

    await loadUsers();

    await loadGroups();
})();

async function openGroup(groupId, groupName) {

    console.log("Открыта группа:", groupId, groupName);

    selectedUser = null;
    currentChatId = `group-${groupId}`;
    selectedGroup = groupId 

    console.log("selectedGroup:", selectedGroup);

    console.log("selectedUser:", selectedUser);

    document.getElementById("chatHeader").innerText = groupName;

    document.getElementById("messages").innerHTML = "";

    try {

        const response = await fetch(
            `${API_URL}/groups/${groupId}/members`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        if (!response.ok) {
            console.error(
                "Ошибка получения участников:",
                await response.text()
            );
            return;
        }

        const members = await response.json();

        console.log("Участники группы:", members);

    } catch (error) {

        console.error("Ошибка открытия группы:", error);

    }
}