import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { Toaster } from '@/components/ui/toaster'

export default function MainLayout() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="orb orb-primary w-[600px] h-[600px] -top-40 -left-40 animate-float" />
        <div className="orb orb-accent w-[500px] h-[500px] top-1/2 -right-40 animate-float" style={{ animationDelay: '-2s' }} />
        <div className="orb orb-warm w-[400px] h-[400px] -bottom-20 left-1/3 animate-float" style={{ animationDelay: '-4s' }} />
      </div>
      
      {/* Noise texture overlay */}
      <div className="fixed inset-0 pointer-events-none noise" />
      
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main content */}
      <main className="pl-24 min-h-screen relative z-10">
        <Outlet />
      </main>
      
      <Toaster />
    </div>
  )
}
