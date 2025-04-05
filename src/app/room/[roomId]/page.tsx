'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getSocket } from '@/lib/socket'

type Player = {
  name: string
  role?: string
}

export default function RoomPage({ params }: { params: { roomId: string } }) {
  const roomId = params.roomId
  const searchParams = useSearchParams()
  const playerName = searchParams.get('name') || ''
  const isHost = searchParams.get('host') === 'true'

  const [players, setPlayers] = useState<Player[]>([])
  const [role, setRole] = useState<string>('')

  useEffect(() => {
    const socket = getSocket()

    if (!socket.connected) socket.connect()

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

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
      <h1 className="text-3xl font-bold mb-6">🎮 غرفة رقم: {roomId}</h1>
      <p className="mb-2">الاسم المستعار: {playerName}</p>
      <p className="mb-4">بانتظار اللاعبين الآخرين...</p>

      <div className="mt-6 w-full max-w-md text-right">
        <h2 className="text-lg font-semibold mb-4">اللاعبين في الغرفة:</h2>
        <div className="flex flex-col gap-3">
          {players.map((player, i) => {
            const showIcon = player.name === playerName ||
              (role.includes('mafia') && ['mafia', 'mafia-leader', 'mafia-police'].includes(player.role ?? ''))

            const icon = player.role === 'citizen' ? '👤 شعب'
              : player.role === 'mafia' ? '🕵️‍♂️ مافيا'
              : player.role === 'mafia-leader' ? '👑 زعيم'
              : player.role === 'mafia-police' ? '🕶️ شرطي مافيا'
              : player.role === 'police' ? '👮‍♂️ شرطي'
              : player.role === 'sniper' ? '🎯 قناص'
              : player.role === 'doctor' ? '🩺 طبيب'
              : ''

            return (
              <div
                key={`${player.name}-${i}`}
                className="flex items-center justify-between bg-gray-800 border border-white px-4 py-2 rounded-lg"
              >
                <span className={showIcon ? 'text-red-500 font-bold' : 'text-white'}>
                  {player.name}
                </span>
                <span className="text-sm text-yellow-400">{showIcon ? icon : ''}</span>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
