import { useNavigate } from 'react-router-dom'
import { clientesService } from '@/lib/clientes'
import { ClienteForm } from './ClienteForm'
import { ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { useState } from 'react'
import type { ClienteFormData } from '@/types'

export function ClienteNovoPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (data: ClienteFormData) => {
    setLoading(true)
    try {
      const created = await clientesService.create(data)
      toast.success('Cliente cadastrado com sucesso!')
      navigate(`/clientes/${created.id}`)
    } catch (e: any) {
      toast.error(e.message || 'Erro ao cadastrar cliente')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/clientes')} className="btn-icon btn-ghost">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="page-title">Novo Cliente</h2>
          <p className="page-subtitle">Preencha os dados do cliente</p>
        </div>
      </div>

      <div className="card p-6">
        <ClienteForm
          onSubmit={handleSubmit}
          onCancel={() => navigate('/clientes')}
          loading={loading}
        />
      </div>
    </div>
  )
}
