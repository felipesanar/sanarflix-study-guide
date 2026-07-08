import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Bell, Save, Eye, X, Copy } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { brazilISOToDatetimeLocal, datetimeLocalToBrazilISO } from '@/utils/timezone';
import { Logger } from '@/utils/logger';

interface IES {
  id: string;
  nome: string;
}

interface AnnouncementConfig {
  id?: string;
  titulo: string;
  descricao: string;
  link_botao: string;
  texto_botao: string;
  paleta_cores: string;
  ativo: boolean;
  data_expiracao: string | null;
  prioridade: 'baixa' | 'media' | 'alta' | 'critica';
  visibilidade: 'todas' | 'seletivo' | 'exceto';
  ies_selecionadas: string[];
  ies_excluidas: string[];
}

const colorPalettes = {
  flame: { from: 'from-red-600 dark:from-red-700', to: 'to-orange-500 dark:to-orange-600', badge: 'bg-white/10 text-white border-white/20' },
  emerald: { from: 'from-emerald-600 dark:from-emerald-700', to: 'to-teal-500 dark:to-teal-600', badge: 'bg-white/10 text-white border-white/20' },
  royal: { from: 'from-blue-600 dark:from-blue-700', to: 'to-purple-600 dark:to-purple-700', badge: 'bg-white/10 text-white border-white/20' },
  sunset: { from: 'from-orange-500 dark:from-orange-600', to: 'to-rose-500 dark:to-rose-600', badge: 'bg-white/10 text-white border-white/20' },
  amethyst: { from: 'from-violet-600 dark:from-violet-700', to: 'to-fuchsia-600 dark:to-fuchsia-700', badge: 'bg-white/10 text-white border-white/20' },
  flameSoft: { from: 'from-red-500/60 dark:from-red-600/60', to: 'to-orange-400/40 dark:to-orange-500/40', badge: 'bg-white/20 text-white border-white/30' },
  emeraldSoft: { from: 'from-emerald-500/60 dark:from-emerald-600/60', to: 'to-teal-400/40 dark:to-teal-500/40', badge: 'bg-white/20 text-white border-white/30' },
  royalSoft: { from: 'from-blue-500/60 dark:from-blue-600/60', to: 'to-purple-500/40 dark:to-purple-600/40', badge: 'bg-white/20 text-white border-white/30' },
  sunsetSoft: { from: 'from-orange-400/60 dark:from-orange-500/60', to: 'to-rose-400/40 dark:to-rose-500/40', badge: 'bg-white/20 text-white border-white/30' },
  amethystSoft: { from: 'from-violet-500/60 dark:from-violet-600/60', to: 'to-fuchsia-500/40 dark:to-fuchsia-600/40', badge: 'bg-white/20 text-white border-white/30' },
};

interface Props {
  config: AnnouncementConfig;
  setConfig: (config: AnnouncementConfig) => void;
  iesList: IES[];
  searchIes: string;
  setSearchIes: (search: string) => void;
  onSave: (configToSave: AnnouncementConfig) => void;
  onCancel: () => void;
  onDuplicate?: () => void;
}

export const AnnouncementEditor: React.FC<Props> = ({
  config,
  setConfig,
  iesList,
  searchIes,
  setSearchIes,
  onSave,
  onCancel,
  onDuplicate
}) => {
  const toggleIes = (iesId: string, type: 'selecionadas' | 'excluidas') => {
    const key = type === 'selecionadas' ? 'ies_selecionadas' : 'ies_excluidas';
    const current = config[key];
    
    if (current.includes(iesId)) {
      setConfig({ ...config, [key]: current.filter(id => id !== iesId) });
    } else {
      setConfig({ ...config, [key]: [...current, iesId] });
    }
  };

  const filteredIes = iesList.filter(ies =>
    ies.nome.toLowerCase().includes(searchIes.toLowerCase())
  );

  // Converter UTC para local time para exibição
  const getLocalDatetimeString = (utcDate: string | null): string => {
    if (!utcDate) return '';
    try {
      return brazilISOToDatetimeLocal(utcDate);
    } catch (e) {
      Logger.error('Error parsing date:', e);
      return '';
    }
  };

  // Converter local time para UTC antes de salvar
  const convertLocalToUTC = (localDatetime: string): string => {
    if (!localDatetime) return '';
    try {
      return datetimeLocalToBrazilISO(localDatetime);
    } catch (e) {
      Logger.error('Error converting to UTC:', e);
      return '';
    }
  };

  const handleSave = () => {
    // Prioridade é salva no vocabulário canônico direto (sem remapeamento —
    // o antigo `mapPriorityForDB` convertia para o legado 'Muito Alta' etc.,
    // mas nunca era chamado; código morto removido).
    // Converter data de expiração para UTC antes de salvar.
    const configToSave: AnnouncementConfig = {
      ...config,
      data_expiracao: config.data_expiracao ? datetimeLocalToBrazilISO(config.data_expiracao) : null
    };
    onSave(configToSave);
  };

  const palette = colorPalettes[config.paleta_cores as keyof typeof colorPalettes] || colorPalettes.flame;

  return (
    <div className="space-y-6">
      {/* Header com ações */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {config.id ? 'Editar Aviso' : 'Novo Aviso'}
        </h2>
        <div className="flex gap-2">
          {config.id && onDuplicate && (
            <Button variant="outline" onClick={onDuplicate}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicar
            </Button>
          )}
          <Button variant="outline" onClick={onCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Pré-visualização
            </CardTitle>
            <CardDescription>Como o aviso aparecerá na home</CardDescription>
          </CardHeader>
              <CardContent>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45 }}
                >
                  <Card className={`relative border-0 bg-gradient-to-br ${palette.from} ${palette.to} shadow-lg`}>
                    <div className="pointer-events-none absolute -bottom-16 -right-16 w-56 h-56 bg-white/10 dark:bg-black/20 blur-3xl rounded-full" />
                    <div className="absolute top-4 right-4 z-10">
                      <Badge variant="default" className={palette.badge}>
                        <Bell className="h-3 w-3 mr-1" />
                        Novo
                      </Badge>
                    </div>

                    <CardHeader className="pb-4 space-y-2">
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 w-12 h-12 bg-gradient-to-br ${palette.from} ${palette.to} rounded-xl flex items-center justify-center ring-2 ring-white/30 dark:ring-black/30`}>
                          <Bell className={`h-6 w-6 ${config.prioridade === 'critica' ? 'text-white fill-white animate-pulse' : config.prioridade === 'alta' ? 'text-white fill-white/50' : config.prioridade === 'media' ? 'text-white fill-white/20' : 'text-white'}`}/>
                        </div>
                        <div className="flex-1 min-w-0 pt-1">
                          <CardTitle className="text-xl font-semibold leading-tight text-white">
                            {config.titulo || 'Título do aviso'}
                          </CardTitle>
                        </div>
                      </div>
                      <div className="h-px bg-gradient-to-r from-border via-border/50 to-transparent" />
                    </CardHeader>

                    <CardContent className="space-y-6">
                      <p className="text-sm text-white leading-relaxed">
                        {config.descricao || 'Descrição do aviso'}
                      </p>
                      <Button className="w-full text-white bg-black/30 hover:bg-black/40 dark:bg-black/40 dark:hover:bg-black/50">
                        {config.texto_botao || 'Texto do botão'}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              </CardContent>
        </Card>

        {/* Editor */}
        <div className="space-y-6">
          {/* Conteúdo */}
          <Card>
            <CardHeader>
              <CardTitle>Conteúdo do Aviso</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="titulo">Título</Label>
                <Input
                  id="titulo"
                  value={config.titulo}
                  onChange={(e) => setConfig({ ...config, titulo: e.target.value })}
                  placeholder="Título do aviso"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={config.descricao}
                  onChange={(e) => setConfig({ ...config, descricao: e.target.value })}
                  placeholder="Descrição do aviso"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="texto_botao">Texto do Botão</Label>
                <Input
                  id="texto_botao"
                  value={config.texto_botao}
                  onChange={(e) => setConfig({ ...config, texto_botao: e.target.value })}
                  placeholder="Ver todos os avisos"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="link_botao">Link do Botão (opcional)</Label>
                <Input
                  id="link_botao"
                  value={config.link_botao}
                  onChange={(e) => setConfig({ ...config, link_botao: e.target.value })}
                  placeholder="https://... ou google.com"
                />
              </div>
            </CardContent>
          </Card>

          {/* Aparência */}
          <Card>
            <CardHeader>
              <CardTitle>Aparência</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Paleta de Cores</Label>
                <Select value={config.paleta_cores} onValueChange={(v) => setConfig({ ...config, paleta_cores: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flame">Flame (Vermelho/Orange)</SelectItem>
                    <SelectItem value="emerald">Emerald (Verde/Teal)</SelectItem>
                    <SelectItem value="royal">Royal (Azul/Indigo/Púrpura)</SelectItem>
                    <SelectItem value="sunset">Sunset (Laranja/Rosa/Rose)</SelectItem>
                    <SelectItem value="amethyst">Amethyst (Violeta/Púrpura/Fúcsia)</SelectItem>
                    <SelectItem value="flameSoft">Flame Soft</SelectItem>
                    <SelectItem value="emeraldSoft">Emerald Soft</SelectItem>
                    <SelectItem value="royalSoft">Royal Soft</SelectItem>
                    <SelectItem value="sunsetSoft">Sunset Soft</SelectItem>
                    <SelectItem value="amethystSoft">Amethyst Soft</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={config.prioridade} onValueChange={(v: any) => setConfig({ ...config, prioridade: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="critica">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Visibilidade */}
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Visibilidade</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup value={config.visibilidade} onValueChange={(v: any) => setConfig({ ...config, visibilidade: v })}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="todas" id="todas" />
                  <Label htmlFor="todas">Todas as IES</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="seletivo" id="seletivo" />
                  <Label htmlFor="seletivo">Apenas IES específicas</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="exceto" id="exceto" />
                  <Label htmlFor="exceto">Todas exceto IES específicas</Label>
                </div>
              </RadioGroup>

              {config.visibilidade !== 'todas' && (
                <div className="space-y-2 pt-4">
                  <Input
                    placeholder="Buscar IES..."
                    value={searchIes}
                    onChange={(e) => setSearchIes(e.target.value)}
                  />
                  <div className="text-sm text-muted-foreground">
                    {config.visibilidade === 'seletivo' 
                      ? `${config.ies_selecionadas.length} de ${iesList.length} IES selecionadas`
                      : `${config.ies_excluidas.length} de ${iesList.length} IES excluídas`
                    }
                  </div>
                  <div className="max-h-64 overflow-y-auto border rounded-lg p-4 space-y-2">
                    {filteredIes.map((ies) => (
                      <div key={ies.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={ies.id}
                          checked={
                            config.visibilidade === 'seletivo'
                              ? config.ies_selecionadas.includes(ies.id)
                              : config.ies_excluidas.includes(ies.id)
                          }
                          onCheckedChange={() => toggleIes(ies.id, config.visibilidade === 'seletivo' ? 'selecionadas' : 'excluidas')}
                        />
                        <Label htmlFor={ies.id} className="cursor-pointer">
                          {ies.nome}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Configurações Gerais */}
          <Card>
            <CardHeader>
              <CardTitle>Configurações Gerais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="ativo">Aviso Ativo</Label>
                <Switch
                  id="ativo"
                  checked={config.ativo}
                  onCheckedChange={(checked) => setConfig({ ...config, ativo: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="data_expiracao">Data de Expiração (opcional)</Label>
                <Input
                  id="data_expiracao"
                  type="datetime-local"
                  value={config.data_expiracao ? getLocalDatetimeString(config.data_expiracao) : ''}
                  onChange={(e) => setConfig({ ...config, data_expiracao: e.target.value || null })}
                />
                <p className="text-xs text-muted-foreground">
                  Horário local (será convertido para UTC ao salvar)
                </p>
              </div>

              <Button onClick={handleSave} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                {config.id ? 'Atualizar Aviso' : 'Salvar Aviso'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
