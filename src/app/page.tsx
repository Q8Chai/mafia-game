'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSocket } from '@/lib/socket'

export default function Home() {
  const [name, setName] = useState('')
  const [roomId, setRoomId] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const handleJoin = () => {
    if (!name || !roomId) {
      setError('يرجى إدخال الاسم ورقم الغرفة')
      return
    }

    const socket = getSocket()
    if (!socket.connected) socket.connect()

    socket.emit('check-room', roomId, (exists: boolean) => {
      console.log('التحقق من الغرفة:', exists)
      if (exists) {
        router.push(`/room/${roomId}?name=${name}&host=false`)
      } else {
        setError('رقم الغرفة غير صحيح')
      }
    })
  }

  const handleCreateRoom = () => {
    if (!name) {
      setError('يرجى إدخال الاسم أولاً')
      return
    }

    const newRoomId = Math.floor(1000 + Math.random() * 9000).toString()
    router.push(`/room/${newRoomId}?name=${name}&host=true`)
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
      <h1 className="text-3xl font-bold mb-6">🎮 لعبة المافيا</h1>

      <input
        type="text"
        placeholder="ادخل اسمك المستعار"
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          setError('')
        }}
        className="mb-4 p-2 rounded bg-gray-800 border border-white text-white w-64 text-center"
      />

      <input
        type="text"
        placeholder="رقم الغرفة للانضمام"
        value={roomId}
        onChange={(e) => {
          setRoomId(e.target.value)
          setError('')
        }}
        className="mb-4 p-2 rounded bg-gray-800 border border-white text-white w-64 text-center"
      />

      {error && <p className="text-red-500 mb-4">{error}</p>}

      <div className="flex gap-4">
        <button
          onClick={handleCreateRoom}
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
        >
          إنشاء غرفة جديدة
        </button>

        <button
          onClick={handleJoin}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          الانضمام إلى غرفة
        </button>
      </div>
    </main>
  )
}
