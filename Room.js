class Room {
  constructor(name, admin) {
    this.name = name;
    this.adminId = admin.id;
    this.started = false;
    this.users = [admin];
  }

  addUser(newUser) {
    this.users = [
      ...this.users.filter((user) => user.id !== newUser.id),
      newUser,
    ];
  }

  removeUser(leaver) {
    this.users = this.users.filter((user) => user.id !== leaver.id);
  }

  startRoom() {
    this.started = true;
  }
}

export default Room;
