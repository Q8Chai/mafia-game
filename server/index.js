const { Server } = require("socket.io");
const PORT = process.env.PORT || 3001;

const io = new Server(PORT, {
  cors: {
    origin: "*",
  },
});

const rooms = {};
const roomSettings = {};

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

  socket.on("start-game", (roomId, settings) => {
    const players = rooms[roomId] || [];
    const playerNames = players.map((p) => p.name);

    const roles = assignRoles(playerNames, settings);

    const playerData = players.map((player) => {
      const found = roles.find((r) => r.name === player.name);
      return { name: player.name, role: found?.role || "citizen" };
    });

    rooms[roomId] = playerData;
    roomSettings[roomId] = settings;

    io.to(roomId).emit("room-players", playerData);

    playerData.forEach(({ name, role }) => {
      io.to(roomId).emit("assign-role", { name, role });
    });
  });
});

console.log(`🚀 Socket.IO server running on port ${PORT}`);


// ✅ توزيع الأدوار حسب الإعدادات بدقة
function assignRoles(players, settings) {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const roles = [];

  const mafiaCount = settings.mafiaCount;
  let index = 0;

  // زعيم المافيا
  if (mafiaCount >= 1 && index < shuffled.length)
    roles.push({ name: shuffled[index++], role: 'mafia-leader' });

  // شرطي المافيا
  if (mafiaCount >= 2 && index < shuffled.length)
    roles.push({ name: shuffled[index++], role: 'mafia-police' });

  // باقي المافيا العاديين
  for (let i = 2; i < mafiaCount && index < shuffled.length; i++) {
    roles.push({ name: shuffled[index++], role: 'mafia' });
  }

  // شرطي
  if (index < shuffled.length) {
    roles.push({ name: shuffled[index++], role: 'police' });
  }

  // قناص
  if (index < shuffled.length) {
    roles.push({ name: shuffled[index++], role: 'sniper' });
  }

  // طبيب (واحد فقط)
  if (index < shuffled.length) {
    roles.push({ name: shuffled[index++], role: 'doctor' });
  }

  // الباقي شعب
  for (; index < shuffled.length; index++) {
    roles.push({ name: shuffled[index], role: 'citizen' });
  }

  return roles;
}
