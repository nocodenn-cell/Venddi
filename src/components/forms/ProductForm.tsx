import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { productSchema, type ProductInput } from '@/lib/api/products'
import { Button, Input, Textarea, Select } from '@/components/ui'

interface ProductFormProps {
  initialData?: Partial<ProductInput> | null
  onSubmit: (data: ProductInput) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

export function ProductForm({ initialData, onSubmit, onCancel, isLoading }: ProductFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: initialData?.name || '',
      sku: initialData?.sku || '',
      barcode: initialData?.barcode || '',
      description: initialData?.description || '',
      costPrice: initialData?.costPrice || 0,
      sellPrice: initialData?.sellPrice || 0,
      stockQuantity: initialData?.stockQuantity || 0,
      minStock: initialData?.minStock || 0,
      isActive: initialData?.isActive ?? true,
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Nome do Produto"
          placeholder="Ex: Camiseta Básica"
          error={errors.name?.message}
          {...register('name')}
        />
        <Input
          label="SKU"
          placeholder="Ex: CAM-001"
          error={errors.sku?.message}
          {...register('sku')}
        />
      </div>

      <Input
        label="Código de Barras"
        placeholder="Ex: 7891234567890"
        error={errors.barcode?.message}
        {...register('barcode')}
      />

      <Textarea
        label="Descrição"
        placeholder="Descrição do produto..."
        error={errors.description?.message}
        {...register('description')}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Preço de Custo (R$)"
          type="number"
          step="0.01"
          placeholder="0.00"
          error={errors.costPrice?.message}
          {...register('costPrice', { valueAsNumber: true })}
        />
        <Input
          label="Preço de Venda (R$)"
          type="number"
          step="0.01"
          placeholder="0.00"
          error={errors.sellPrice?.message}
          {...register('sellPrice', { valueAsNumber: true })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Quantidade em Estoque"
          type="number"
          placeholder="0"
          error={errors.stockQuantity?.message}
          {...register('stockQuantity', { valueAsNumber: true })}
        />
        <Input
          label="Estoque Mínimo"
          type="number"
          placeholder="0"
          error={errors.minStock?.message}
          {...register('minStock', { valueAsNumber: true })}
        />
      </div>

      <Select
        label="Status"
        options={[
          { value: 'true', label: 'Ativo' },
          { value: 'false', label: 'Inativo' },
        ]}
        {...register('isActive')}
      />

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={isLoading}>
          {initialData ? 'Atualizar' : 'Criar'} Produto
        </Button>
      </div>
    </form>
  )
}
