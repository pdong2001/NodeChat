const socket = io.connect("/", {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 99999,
});

socket.on("disconnect", function () {
  console.log("disconnected");
});
socket.on( 'connect', function () {
    console.log( 'connected to server' );
} );

const listGrid = document.getElementById("list-grid");

const myVideo = document.getElementById("video");
const myQueue = document.getElementById("queue");
const nextButton = document.querySelector("#queue button");
const sendMessageButton = document.getElementById("send");
const messageInput = document.getElementById("message");
const messageContaienr = document.getElementById("message-container");
const userNameInput = document.getElementById("username");
const addButton = document.getElementById("add-new");
const userCount = document.getElementById("connected-count");
const title = "Room Chat - PDong";

var newMessageIntervel;

userNameInput.value = localStorage.getItem("userName");
userNameInput.addEventListener("input", function (e) {
  localStorage.setItem("userName", e.currentTarget.value);
});

document.addEventListener("click", () => {
  if (newMessageIntervel) {
    clearInterval(newMessageIntervel);
  }
  document.title = "Room chat";
});

socket.on("new-message", (sender, message) => {
  if (newMessageIntervel) {
    clearInterval(newMessageIntervel);
  }
  newMessageIntervel = setInterval(() => {
    if (document.title == title) {
      document.title = `${sender} đã gửi tin nhắn cho bạn`;
    } else {
      document.title = title;
    }
  }, 1000);
  var div = document.createElement("div");
  var strong = document.createElement("strong");
  var span = document.createElement("span");
  div.className = "d-flex m-2";
  span.className = "mx-1 alert alert-success";
  strong.innerHTML = sender;
  span.innerHTML = message;
  div.append(strong);
  div.append(span);
  messageContaienr.append(div);
  messageContaienr.scrollTop = messageContaienr.scrollHeight;
});

messageInput.addEventListener("keyup", (event) => {
  if (event.keyCode === 13) {
    // Cancel the default action, if needed
    event.preventDefault();
    // Trigger the button element with a click
    sendMessageButton.click();
  }
});

sendMessageButton.addEventListener("click", () => {
  var message = messageInput.value;
  messageInput.value = "";
  var sender = userNameInput.value;
  if (!sender || sender.trim() == "") {
    alert("Nhập tên vào đi bạn ơi.");
    userNameInput.focus();
    return;
  }
  if (message && message.trim() != "") {
    var div = document.createElement("div");
    var span = document.createElement("span");
    div.className = "d-flex m-2";
    span.className = "m-1 ms-auto  alert alert-primary";
    span.innerHTML = message;
    div.append(span);
    messageContaienr.append(div);
    messageContaienr.scrollTop = messageContaienr.scrollHeight;
    socket.emit("new-message", sender, message);
  }
});

myVideo.addEventListener("canplay", () => {
  if (myVideo.paused) myVideo.play();
});

socket.on("play", (item, time) => {
  myVideo.title = item.title ?? "";
  myVideo.src = item.id ? "/video/" + item.id : "";
  const oldPlay = document.querySelector("#queue .active");
  if (oldPlay) {
    oldPlay.remove();
  }
  if (item.id) {
    const nowPlaying = document.getElementById(item.id);
    if (nowPlaying) {
      nowPlaying.className = "active";
    }
  }
  if (time) {
    myVideo.currentTime = time / 1000;
    if (myVideo.paused) {
      myVideo.play();
    }
  }
});

myVideo.addEventListener("ended", () => {
  socket.emit("next");
});

nextButton.addEventListener("click", () => {
  socket.emit("next");
});

socket.on("new", (item) => {
  const div = document.createElement("div");
  div.title = item.title;
  div.innerHTML = item.title;
  div.id = item.id;
  myQueue.append(div);
});

socket.on("timeupdate", (time) => {
  if (myVideo.currentTime > time + 1 || myVideo.currentTime < time - 1) {
    myVideo.currentTime = time;
  }
});
myVideo.addEventListener("seeked", () => {
  socket.emit("timeupdate", myVideo.currentTime);
});

socket.on("user-connected-change", (count) => {
  userCount.innerHTML = count;
  console.log(count);
});

socket.emit("join-room", ROOM_ID, 10);

addButton.addEventListener("click", (e) => {
  socket.emit("new", document.querySelector("input").value);
});

document.getElementById("ytbInput").addEventListener("keyup", (event) => {
  if (event.keyCode === 13) {
    // Cancel the default action, if needed
    event.preventDefault();
    // Trigger the button element with a click
    addButton.click();
  }
});
