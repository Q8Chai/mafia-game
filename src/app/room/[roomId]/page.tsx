'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { getSocket } from '@/lib/socket'

type Player = {
  name: string
  role?: string
  kicked?: boolean
}

export default function RoomPage({ params }: { params: { roomId: string } }) {
  const searchParams = useSearchParams()
  const playerName = searchParams.get('name') || ''
  const isHost = searchParams.get('host') === 'true'
  const [roomId, setRoomId] = useState('')
  const [players, setPlayers] = useState<Player[]>([])
  const [role, setRole] = useState<string>('')
  const [showSettings, setShowSettings] = useState(false)
  const [showKickMode, setShowKickMode] = useState(false)
  const [playerToKick, setPlayerToKick] = useState('')
  const [askedPlayer, setAskedPlayer] = useState('')
  const [questionResult, setQuestionResult] = useState<'mafia' | 'not-mafia' | ''>('')
  const [waitingForPolice, setWaitingForPolice] = useState(true)
  const [settings, setSettings] = useState({
    mafiaCount: 3,
    mafiaKills: 2,
    mafiaSilence: 2,
    mafiaTargetSilence: 1,
    policeQuestions: 2,
    doctorSaves: 2,
  })

  const isMafia = ['mafia', 'mafia-leader', 'mafia-police'].includes(role)
  const isPolice = role === 'police'

  useEffect(() => {
    setRoomId(params.roomId)
  }, [params])

  useEffect(() => {
    if (!roomId) return
    const socket = getSocket()
    if (!socket.connected) socket.connect()

    socket.emit('join-room', { roomId, name: playerName })

    socket.on('room-players', (playersList: Player[]) => {
      setPlayers(playersList)
    })

    socket.on('assign-role', ({ name, role }) => {
      if (name === playerName) setRole(role)
    })

    // ✅ تصحيح TypeScript هنا
    return () => {
      socket.disconnect()
    }
  }, [roomId, playerName])

  const handleStartGame = () => {
    const socket = getSocket()
    socket.emit('start-game', roomId, settings)
    setShowSettings(false)
    setWaitingForPolice(true)
  }

  const handleAskPlayer = (name: string) => {
    setAskedPlayer(name)
    const player = players.find(p => p.name === name)
    const result = player?.role && ['mafia', 'mafia-leader', 'mafia-police'].includes(player.role)
    setQuestionResult(result ? 'mafia' : 'not-mafia')
    setWaitingForPolice(false)
  }

  const handleKick = () => {
    const socket = getSocket()
    socket.emit('kick-player', { roomId, name: playerToKick })
    setPlayerToKick('')
    setShowKickMode(false)
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
      {isHost && (
        <div className="flex justify-between w-full max-w-4xl mb-4">
          <button onClick={() => setShowSettings(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            إعدادات اللعبة
          </button>
          <div className="flex flex-col items-end gap-2">
            <button
              className={`py-2 px-4 rounded font-bold ${waitingForPolice ? 'bg-gray-500' : 'bg-green-600 hover:bg-green-700'}`}
              disabled={waitingForPolice}
            >
              ابدأ الجولة
            </button>
            <button onClick={() => setShowKickMode(true)} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">
              طرد لاعب
            </button>
          </div>
        </div>
      )}

      {showKickMode && (
        <div className="mb-4">
          <h2 className="mb-2">اختر لاعب لطرده:</h2>
          <div className="flex flex-col gap-2">
            {players.map(p => (
              <button
                key={p.name}
                onClick={() => setPlayerToKick(p.name)}
                className={`py-1 px-2 rounded ${playerToKick === p.name ? 'bg-red-500' : 'bg-gray-700'}`}
              >
                {p.name}
              </button>
            ))}
          </div>
          <button onClick={handleKick} className="mt-2 bg-red-600 px-4 py-2 rounded">تأكيد الطرد</button>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 bg-opacity-80 backdrop-blur-lg p-6 rounded-xl w-full max-w-md text-white space-y-4 shadow-2xl border border-white/20">
            <h2 className="text-xl font-bold mb-4 text-center">إعدادات اللعبة</h2>

            <label>عدد المافيا</label>
            <select className="w-full p-2 rounded bg-gray-800" value={settings.mafiaCount}
              onChange={(e) => setSettings({ ...settings, mafiaCount: parseInt(e.target.value) })}>
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
            </select>

            <label>عدد الاغتيالات</label>
            <select className="w-full p-2 rounded bg-gray-800" value={settings.mafiaKills}
              onChange={(e) => setSettings({ ...settings, mafiaKills: parseInt(e.target.value) })}>
              {[1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}
            </select>

            <label>عدد مرات الاسكات الجماعي</label>
            <select className="w-full p-2 rounded bg-gray-800" value={settings.mafiaSilence}
              onChange={(e) => setSettings({ ...settings, mafiaSilence: parseInt(e.target.value) })}>
              {[1, 2].map(n => <option key={n} value={n}>{n}</option>)}
            </select>

            <label>اسكات لاعب معين</label>
            <select className="w-full p-2 rounded bg-gray-800" value={settings.mafiaTargetSilence}
              onChange={(e) => setSettings({ ...settings, mafiaTargetSilence: parseInt(e.target.value) })}>
              {[0, 1].map(n => <option key={n} value={n}>{n === 1 ? 'مسموح' : 'غير مسموح'}</option>)}
            </select>

            <label>عدد أسئلة الشرطي</label>
            <select className="w-full p-2 rounded bg-gray-800" value={settings.policeQuestions}
              onChange={(e) => setSettings({ ...settings, policeQuestions: parseInt(e.target.value) })}>
              {[1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}
            </select>

            <label>عدد مرات الحماية للطبيب</label>
            <select className="w-full p-2 rounded bg-gray-800" value={settings.doctorSaves}
              onChange={(e) => setSettings({ ...settings, doctorSaves: parseInt(e.target.value) })}>
              {[1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}
            </select>

            <div className="flex justify-between pt-4">
              <button onClick={() => setShowSettings(false)} className="px-4 py-2 bg-gray-700 rounded">إلغاء</button>
              <button onClick={handleStartGame} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-bold">ابدأ اللعبة</button>
            </div>
          </div>
        </div>
      )}

      {isPolice && waitingForPolice && (
        <div className="my-4 flex gap-4">
          <button onClick={() => setWaitingForPolice(false)} className="bg-yellow-600 px-4 py-2 rounded">تأجيل السؤال</button>
          <span className="text-white">أو اختر لاعب لسؤاله:</span>
        </div>
      )}

      <div className="mt-6 w-full max-w-md text-right">
        <h2 className="text-lg font-semibold mb-4">اللاعبين في الغرفة:</h2>
        <div className="flex flex-col gap-3">
          {players.map((player, i) => {
            const isRoleMafia = (r?: string) => ['mafia', 'mafia-leader', 'mafia-police'].includes(r || '')
            const isVisibleToMafia = isMafia && isRoleMafia(player.role)
            const isCurrent = player.name === playerName
            const icon =
              player.kicked ? '💀 مطرود' :
              player.role === 'citizen' ? '👤 شعب' :
              player.role === 'mafia' ? '🕵️‍♂️ مافيا' :
              player.role === 'mafia-leader' ? '👑 زعيم' :
              player.role === 'mafia-police' ? '🕶️ شرطي مافيا' :
              player.role === 'police' ? '👮‍♂️ شرطي' :
              player.role === 'sniper' ? '🎯 قناص' :
              player.role === 'doctor' ? '🩺 طبيب' : ''

            const showIcon = isCurrent || isVisibleToMafia

            const highlight = player.name === askedPlayer
              ? questionResult === 'mafia' ? 'bg-red-700' : questionResult === 'not-mafia' ? 'bg-green-700' : ''
              : ''

            return (
              <div
                key={`${player.name}-${i}`}
                onClick={() => isPolice && waitingForPolice && handleAskPlayer(player.name)}
                className={`cursor-pointer flex items-center justify-between ${highlight} bg-gray-800 border border-white px-4 py-2 rounded-lg`}
              >
                <span className={isVisibleToMafia ? 'text-red-500 font-bold' : 'text-white'}>{player.name}</span>
                <span className="text-sm text-yellow-400">{showIcon && icon}</span>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
