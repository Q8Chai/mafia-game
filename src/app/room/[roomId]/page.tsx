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
  const [canStartRound, setCanStartRound] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [kickMode, setKickMode] = useState(false)
  const [selectedToKick, setSelectedToKick] = useState<string | null>(null)
  const [questioning, setQuestioning] = useState(false)
  const [askedPlayer, setAskedPlayer] = useState<string | null>(null)
  const [showResult, setShowResult] = useState<'mafia' | 'not-mafia' | null>(null)

  const [settings, setSettings] = useState({
    mafiaCount: 3,
    mafiaKills: 2,
    mafiaSilence: 2,
    mafiaTargetSilence: 1,
    policeQuestions: 2,
    doctorSaves: 2,
  })

  const isMafia = role === 'mafia' || role === 'mafia-leader' || role === 'mafia-police'
  const isPolice = role === 'police'

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

  const handleStartGame = () => {
    const socket = getSocket()
    socket.emit('start-game', roomId, settings)
    setShowSettings(false)
  }

  const handleStartRound = () => {
    // Add round start logic here
    setCanStartRound(false)
  }

  const handleKickConfirm = () => {
    if (!selectedToKick) return
    const socket = getSocket()
    socket.emit('kick-player', { roomId, name: selectedToKick })
    setKickMode(false)
    setSelectedToKick(null)
  }

  const handleAskNow = () => {
    setQuestioning(true)
  }

  const confirmAsk = () => {
    if (!askedPlayer) return
    const target = players.find(p => p.name === askedPlayer)
    if (!target) return
    const isMafia = ['mafia', 'mafia-leader', 'mafia-police'].includes(target.role || '')
    setShowResult(isMafia ? 'mafia' : 'not-mafia')
    setCanStartRound(true)
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
            const showRole = player.name === playerName ||
              (isMafia && (player.role === 'mafia' || player.role === 'mafia-leader' || player.role === 'mafia-police'))

            const isVisibleToMafia =
              isMafia && (player.role === 'mafia' || player.role === 'mafia-leader' || player.role === 'mafia-police')

            let icon = ''
            if (player.name === playerName || isVisibleToMafia) {
              icon = player.role === 'citizen' ? '👤 شعب'
                : player.role === 'mafia' ? '🕵️‍♂️ مافيا'
                : player.role === 'mafia-leader' ? '👑 زعيم'
                : player.role === 'mafia-police' ? '🕶️ شرطي مافيا'
                : player.role === 'police' ? '👮‍♂️ شرطي'
                : player.role === 'sniper' ? '🎯 قناص'
                : player.role === 'doctor' ? '🩺 طبيب'
                : ''
            }

            const isKickable = kickMode && player.name !== playerName
            const isSelectedToKick = selectedToKick === player.name

            const isSelectableByPolice = questioning && isPolice && player.name !== playerName
            const isSelectedByPolice = askedPlayer === player.name

            return (
              <div
                key={`${player.name}-${i}`}
                onClick={() => {
                  if (isKickable) setSelectedToKick(player.name)
                  if (isSelectableByPolice) setAskedPlayer(player.name)
                }}
                className={`flex items-center justify-between bg-gray-800 border ${isSelectedToKick || isSelectedByPolice ? 'border-green-500' : 'border-white'} px-4 py-2 rounded-lg cursor-pointer`}
              >
                <span className={isVisibleToMafia ? 'text-red-500 font-bold' : 'text-white'}>
                  {player.name}
                </span>
                <span className={`text-sm ${showResult && askedPlayer === player.name ? (showResult === 'mafia' ? 'text-red-400' : 'text-green-400') : 'text-yellow-400'}`}>{icon}</span>
              </div>
            )
          })}
        </div>
      </div>

      {isHost && (
        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            onClick={() => setShowSettings(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            إعدادات اللعبة
          </button>

          <button
            onClick={handleStartRound}
            disabled={!canStartRound}
            className={`px-4 py-2 font-bold rounded ${canStartRound ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 cursor-not-allowed'}`}
          >
            ابدأ الجولة
          </button>

          <button
            onClick={() => setKickMode(!kickMode)}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
          >
            طرد لاعب
          </button>

          {kickMode && selectedToKick && (
            <button
              onClick={handleKickConfirm}
              className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded"
            >
              تأكيد الطرد
            </button>
          )}
        </div>
      )}

      {isPolice && !canStartRound && !questioning && (
        <div className="mt-6 flex gap-4">
          <button onClick={handleAskNow} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded">
            اسأل الآن
          </button>
          <button onClick={() => setCanStartRound(true)} className="bg-gray-700 hover:bg-gray-800 px-4 py-2 rounded">
            تأجيل السؤال
          </button>
        </div>
      )}

      {questioning && isPolice && askedPlayer && !showResult && (
        <div className="mt-4 flex gap-4">
          <button onClick={confirmAsk} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded">تأكيد</button>
          <button onClick={() => setAskedPlayer(null)} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded">إلغاء</button>
        </div>
      )}

      {role && (
        <div className="mt-8 text-xl font-bold text-yellow-400 flex items-center gap-2">
          🎭 دورك هو:{' '}
          {role === 'doctor'
            ? 'طبيب'
            : role === 'mafia'
            ? 'مافيا'
            : role === 'mafia-leader'
            ? 'زعيم المافيا'
            : role === 'mafia-police'
            ? 'شرطي مافيا'
            : role === 'police'
            ? 'شرطي'
            : role === 'sniper'
            ? 'قناص'
            : 'شعب'}
        </div>
      )}
    </main>
  )
}
