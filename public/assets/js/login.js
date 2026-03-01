const form = document.getElementById("loginForm");
const usernameEl = document.getElementById("username");
const passwordEl = document.getElementById("password");
const errEl = document.getElementById("loginError");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errEl.classList.add("hidden");

  const username = usernameEl.value.trim();
  const password = passwordEl.value;

  const res = await fetch("/auth/login", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({username, password}),
  });

  let data = null;
  try {
    data = await res.json();
  } catch (err) {
    data = null;
  }

  if (!res.ok || !data || !data.ok) {
    errEl.textContent = (data && data.message) || "登录失败";
    errEl.classList.remove("hidden");
    return;
  }

  window.location.href = "/";
});
