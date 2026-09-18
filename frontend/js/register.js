alert('запущено')
const form = document.getElementById("registerForm");

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    const response = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            username,
            email,
            password
        })
    });

    const result = await response.json();

    if (response.ok) {
        alert("Регистрация успешна!");
        window.location.href = "/login-page";
    } else {
        alert(result.detail || result.error || "Ошибка регистрации");
    }
});