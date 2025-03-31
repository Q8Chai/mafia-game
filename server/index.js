const { Server } = require("socket.io");

// استخدم البورت من المتغيرات البيئية في Render أو 3001 محليًا
const PORT = process.env.PORT || 3001;

const io = new Server(PORT, {
  cors: {
    origin: "*",
  },
});

const rooms = {};
const roomData = {};

io.on("connection", (socket) => {
  socket.on("join-room", ({ roomId, name }) => {
    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }

    if (!rooms[roomId].some((p) => p.name === name)) {
      rooms[roomId].push({ name });
    }

    socket.join(roomId);
    io.to(roomId).emit("room-players", rooms[roomId]);
  });

  socket.on("check-room", (roomId, callback) => {
    const exists = !!rooms[roomId];
    callback(exists);
  });

  socket.on("start-game", (roomId) => {
    const players = rooms[roomId] || [];
    const roles = assignRoles(players.map((p) => p.name));

    const playerData = players.map((player) => {
      const found = roles.find((r) => r.name === player.name);
      return { name: player.name, role: found?.role || "citizen" };
    });

    rooms[roomId] = playerData;

    // إعداد صلاحيات المافيا
    const totalPlayers = players.length;
    const mafiaAbilities = {
      kills: totalPlayers > 10 ? 3 : 2,
      silences: totalPlayers > 10 ? 2 : 1,
      targetSilenceUsed: false,
    };

    roomData[roomId] = {
      players: playerData,
      mafiaAbilities,
    };

    io.to(roomId).emit("room-players", playerData);

    playerData.forEach(({ name, role }) => {
      io.to(roomId).emit("assign-role", { name, role });
    });
  });
});

console.log(`🚀 Socket.IO server running at http://localhost:${PORT}`);

// توزيع الأدوار تلقائيًا حسب عدد اللاعبين
function assignRoles(players) {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const roles = [];

  const totalPlayers = players.length;
  const mafiaCount = totalPlayers >= 12 ? 4 : totalPlayers >= 10 ? 3 : 2;

  // زعيم المافيا
  roles.push({ name: shuffled[0], role: "mafia-leader" });

  // شرطي المافيا
  if (mafiaCount >= 2) {
    roles.push({ name: shuffled[1], role: "mafia-police" });
  }

  // بقية المافيا
  for (let i = 2; i < mafiaCount; i++) {
    roles.push({ name: shuffled[i], role: "mafia" });
  }

  // أدوار خاصة
  const specialRoles = ["police", "sniper", "doctor"];
  let specialIndex = mafiaCount;

  for (let role of specialRoles) {
    if (specialIndex < shuffled.length) {
      roles.push({ name: shuffled[specialIndex], role });
      specialIndex++;
    }
  }

  // الباقي شعب
  for (let i = specialIndex; i < shuffled.length; i++) {
    roles.push({ name: shuffled[i], role: "citizen" });
  }

  return roles;
}
