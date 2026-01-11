import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, Loader2, Waves, Brain, MessageSquare, Shield, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const success = await login(email, password)
    
    if (success) {
      navigate('/dashboard')
    } else {
      setError('登录失败，请检查邮箱和密码')
    }
    setIsLoading(false)
  }

  const features = [
    { icon: Link2, label: '认知对齐', color: 'text-cyan-400' },
    { icon: Brain, label: '深度理解', color: 'text-violet-400' },
    { icon: MessageSquare, label: '智能问答', color: 'text-emerald-400' },
  ]

  return (
    <div className="min-h-screen w-full flex relative overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 bg-[#0a0a12]">
        {/* Gradient orbs */}
        <div className="orb orb-primary w-[800px] h-[800px] -top-40 -left-40" />
        <div className="orb orb-accent w-[600px] h-[600px] bottom-0 right-0" style={{ opacity: 0.2 }} />
        
        {/* Animated grid */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(139, 92, 246, 0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(139, 92, 246, 0.5) 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px',
          }}
        />
        
        {/* Floating particles */}
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white/20 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${4 + Math.random() * 4}s`,
            }}
          />
        ))}
      </div>

      {/* Left side - Branding */}
      <div className="hidden lg:flex flex-1 items-center justify-center relative p-12">
        <div className="max-w-lg animate-slide-up">
          {/* Logo */}
          <div className="flex items-center gap-4 mb-12">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-2xl blur-xl opacity-50" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                <Waves className="w-8 h-8 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">MeetMind · 视界</h1>
              <p className="text-white/50">认知对齐工具</p>
            </div>
          </div>

          {/* Tagline */}
          <h2 className="text-5xl font-bold text-white leading-tight mb-6">
            不只是记录
            <br />
            <span className="text-gradient">而是真正理解</span>
          </h2>
          <p className="text-xl text-white/50 mb-12 leading-relaxed">
            帮你与老师、与他人保持认知同步。
            <br />
            消除「听了但没懂」的信息损耗。
          </p>

          {/* Features */}
          <div className="flex items-center gap-8">
            {features.map((feature, index) => (
              <div 
                key={feature.label}
                className="flex items-center gap-3 animate-slide-up"
                style={{ animationDelay: `${0.2 + index * 0.1}s` }}
              >
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                  <feature.icon className={cn('w-5 h-5', feature.color)} />
                </div>
                <span className="text-white/70 font-medium">{feature.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center p-8 relative z-10">
        <div className="w-full max-w-md animate-slide-up stagger-2">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-2xl shadow-violet-500/30 mb-4">
              <Waves className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">MeetMind · 视界</h1>
            <p className="text-white/50 mt-1">认知对齐工具</p>
          </div>

          {/* Login card */}
          <div className="glass-card rounded-3xl p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">欢迎回来</h2>
              <p className="text-white/50">登录您的账户继续使用</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center animate-scale-in">
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/70 text-sm font-medium">邮箱地址</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={cn(
                    'h-14 rounded-xl px-4',
                    'bg-white/5 border-white/10 text-white placeholder:text-white/30',
                    'focus:bg-white/10 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20',
                    'transition-all duration-300'
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/70 text-sm font-medium">密码</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className={cn(
                      'h-14 rounded-xl px-4 pr-12',
                      'bg-white/5 border-white/10 text-white placeholder:text-white/30',
                      'focus:bg-white/10 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20',
                      'transition-all duration-300'
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className={cn(
                  'w-full h-14 rounded-xl font-semibold text-lg',
                  'bg-gradient-to-r from-violet-500 to-fuchsia-500',
                  'hover:from-violet-600 hover:to-fuchsia-600',
                  'shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50',
                  'transition-all duration-300 hover-lift',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    登录中...
                  </>
                ) : (
                  '登录'
                )}
              </Button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-white/50">
                还没有账户？{' '}
                <Link 
                  to="/register" 
                  className="text-violet-400 hover:text-violet-300 font-semibold transition-colors"
                >
                  立即注册
                </Link>
              </p>
            </div>
          </div>

          {/* Security hint */}
          <div className="mt-6 flex items-center justify-center gap-2 text-white/30 text-sm">
            <Shield className="w-4 h-4" />
            <span>您的数据将被安全加密存储</span>
          </div>
        </div>
      </div>
    </div>
  )
}
