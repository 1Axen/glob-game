import * as config from "../config.json"
function is_valid_username(username: string) {
    const pattern = /^\w*$/;
    return pattern.exec(username) !== null;
}

window.onload = function() {
    const start_button = document.getElementById("startButton") as HTMLButtonElement
    const username_input = document.getElementById("usernameInput") as HTMLInputElement
    const username_error_text = document.querySelector("#startMenu .input-error") as HTMLTextAreaElement

    start_button.onclick = function() {
        var username = username_input.value
        if (!is_valid_username(username)) {
            username_error_text.style.opacity = "1"
            return
        }

        username_error_text.style.opacity = "0"
    }

    username_input.addEventListener("keypress", function(e) {
        var key = e.key
        console.log(key)
    })    
}