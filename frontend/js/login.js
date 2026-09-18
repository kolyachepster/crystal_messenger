const form = document.getElementById("loginForm");

form.addEventListener("submit", async (e) => {

    e.preventDefault();

    const email = document.getElementById("email").value;

    const password = document.getElementById("password").value;

    const body = new URLSearchParams();

    body.append("username", email);
    body.append("password", password);

    const response = await fetch(
        "http://127.0.0.1:8000/login",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },

            body: body
        }
    );

    const data = await response.json();

    console.log(data);

    if(response.ok){

        localStorage.setItem(
            "token",
            data.access_token
        );

        window.location.href = "/chat";

    } else {

        alert(data.detail);

    }

});