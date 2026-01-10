import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { quotaApi } from '@/services/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  User,
  Bell,
  Zap,
  Shield,
  Palette,
  Save,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function SettingsPage() {
  const { user, updateUser } = useAuth()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [quota, setQuota] = useState({ used: 0, total: 100, remaining: 100 })

  const [settings, setSettings] = useState({
    name: user?.name || '',
    email: user?.email || '',
    notifications: {
      email: true,
      push: true,
      insights: true,
    },
    ai: {
      autoInsights: true,
      periodicSummary: true,
      summaryInterval: 5,
    },
    appearance: {
      darkMode: true,
      compactMode: false,
    },
  })

  useEffect(() => {
    loadQuota()
  }, [])

  const loadQuota = async () => {
    const response = await quotaApi.get()
    if (response.data.success && response.data.data) {
      setQuota(response.data.data)
    }
  }

  const handleSave = async () => {
    setIsLoading(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    updateUser({ ...user!, name: settings.name })
    toast({
      title: '设置已保存',
      description: '您的设置已成功更新',
    })
    setIsLoading(false)
  }

  const quotaPercentage = (quota.used / quota.total) * 100

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">设置</h1>
        <p className="text-slate-400">管理您的账户和应用偏好</p>
      </div>

      <div className="space-y-6">
        {/* Profile */}
        <Card className="border-0 bg-white/5 backdrop-blur-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                <User className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <CardTitle className="text-white">个人资料</CardTitle>
                <CardDescription className="text-slate-400">管理您的账户信息</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-6">
              <Avatar className="w-20 h-20 border-2 border-indigo-500/30">
                <AvatarImage src={user?.avatar} />
                <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-2xl">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <Button variant="outline" className="border-white/10 text-slate-300 hover:text-white">
                更换头像
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">用户名</Label>
                <Input
                  value={settings.name}
                  onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">邮箱</Label>
                <Input
                  value={settings.email}
                  disabled
                  className="bg-white/5 border-white/10 text-slate-400"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quota */}
        <Card className="border-0 bg-white/5 backdrop-blur-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-white">API 配额</CardTitle>
                <CardDescription className="text-slate-400">查看您的使用情况</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">已使用</span>
                <span className="text-white font-medium">{quota.used} / {quota.total} 次</span>
              </div>
              <Progress value={quotaPercentage} className="h-2 bg-white/10" />
              <p className="text-sm text-slate-400">
                剩余 {quota.remaining} 次调用，每月重置
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="border-0 bg-white/5 backdrop-blur-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Bell className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-white">通知设置</CardTitle>
                <CardDescription className="text-slate-400">管理通知偏好</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">邮件通知</p>
                <p className="text-sm text-slate-400">接收会议总结和重要更新</p>
              </div>
              <Switch
                checked={settings.notifications.email}
                onCheckedChange={(checked) =>
                  setSettings({
                    ...settings,
                    notifications: { ...settings.notifications, email: checked },
                  })
                }
              />
            </div>
            <Separator className="bg-white/10" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">AI 洞察通知</p>
                <p className="text-sm text-slate-400">当 AI 生成新洞察时通知</p>
              </div>
              <Switch
                checked={settings.notifications.insights}
                onCheckedChange={(checked) =>
                  setSettings({
                    ...settings,
                    notifications: { ...settings.notifications, insights: checked },
                  })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* AI Settings */}
        <Card className="border-0 bg-white/5 backdrop-blur-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-white">AI 设置</CardTitle>
                <CardDescription className="text-slate-400">自定义 AI 行为</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">自动洞察</p>
                <p className="text-sm text-slate-400">AI 自动分析对话并生成洞察</p>
              </div>
              <Switch
                checked={settings.ai.autoInsights}
                onCheckedChange={(checked) =>
                  setSettings({
                    ...settings,
                    ai: { ...settings.ai, autoInsights: checked },
                  })
                }
              />
            </div>
            <Separator className="bg-white/10" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">定期总结</p>
                <p className="text-sm text-slate-400">每隔一段时间生成阶段性总结</p>
              </div>
              <Switch
                checked={settings.ai.periodicSummary}
                onCheckedChange={(checked) =>
                  setSettings({
                    ...settings,
                    ai: { ...settings.ai, periodicSummary: checked },
                  })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Save button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isLoading}
            className="bg-indigo-500 hover:bg-indigo-600 px-8"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                保存设置
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
