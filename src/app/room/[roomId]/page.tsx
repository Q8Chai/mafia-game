'use client'

import { use, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { getSocket } from '@/lib/socket'

type Player = {
  name: string
  role?: string
}

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params)
  const searchParams = useSearchParams()
  const playerName = searchParams.get('name') || ''
  const isHost = searchParams.get('host') === 'true'

  const [players, setPlayers] = useState<Player[]>([])
  const [role, setRole] = useState<string>('')

  const isMafia = role === 'mafia' || role === 'mafia-leader'

  useEffect(() => {
    const socket = getSocket()

    if (!socket.connected) {
      socket.connect()
    }

    socket.emit('join-room', { roomId, name: playerName })

    socket.on('room-players', (playersList: Player[]) => {
      setPlayers(playersList)
    })

    socket.on('assign-role', ({ name, role }) => {
      if (name === playerName) setRole(role)
    })

    return () => {
      socket.disconnect()
    }
  }, [roomId, playerName])

  const handleStartGame = () => {
    const socket = getSocket()
    socket.emit('start-game', roomId)
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
      <h1 className="text-3xl font-bold mb-6">🎮 غرفة رقم: {roomId}</h1>
      <p className="mb-2">الاسم المستعار: {playerName}</p>
      <p className="mb-4">بانتظار اللاعبين الآخرين...</p>

      <div className="mt-6 w-full max-w-md text-right">
        <h2 className="text-lg font-semibold mb-4">اللاعبين في الغرفة:</h2>
        <div className="flex flex-col gap-3">
          {players.map((player, i) => {
            const showRole =
              player.name === playerName ||
              (isMafia && (player.role === 'mafia' || player.role === 'mafia-leader'))

            const isVisibleToMafia =
              isMafia && (player.role === 'mafia' || player.role === 'mafia-leader')

            return (
              <div
                key={i}
                className="flex items-center justify-between bg-gray-800 border border-white px-4 py-2 rounded-lg"
              >
                <span
                  className={`${
                    isVisibleToMafia
                      ? 'text-red-500 font-bold'
                      : 'text-white'
                  }`}
                >
                  {player.name}
                </span>

                {showRole && (
                  <span className="text-sm text-yellow-400">
                    {player.role === 'citizen' && '👤 شعب'}
                    {player.role === 'mafia' && '🕵️‍♂️ مافيا'}
                    {player.role === 'mafia-leader' && '👑 زعيم'}
                    {player.role === 'police' && '👮‍♂️ شرطي'}
                    {player.role === 'sniper' && '🎯 قناص'}
                    {player.role === 'doctor' && '🩺 طبيب'}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {isHost && (
        <button
          onClick={handleStartGame}
          disabled={players.length < 5}
          className={`mt-6 font-bold py-2 px-4 rounded transition ${
            players.length < 5
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          ابدأ اللعبة
        </button>
      )}

      {role && (
        <div className="mt-8 text-xl font-bold text-yellow-400 flex items-center gap-2">
          🎭 دورك هو:{" "}
          {role === 'citizen'
            ? 'شعب'
            : role === 'mafia'
            ? 'مافيا'
            : role === 'mafia-leader'
            ? 'زعيم المافيا'
            : role === 'police'
            ? 'شرطي'
            : role === 'sniper'
            ? 'قناص'
            : 'طبيب'}
        </div>
      )}
    </main>
  )
}
