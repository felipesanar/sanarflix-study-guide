import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
import { Bell, Save, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

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
  prioridade: 'baixa' | 'media' | 'alta';
  visibilidade: 'todas' | 'seletivo' | 'exceto';
  ies_selecionadas: string[];
  ies_excluidas: string[];
}

const colorPalettes = {
  primary: { from: 'from-primary/20', to: 'to-primary/10', badge: 'bg-primary/10 text-primary border-primary/20' },
  success: { from: 'from-green-500/20', to: 'to-green-500/10', badge: 'bg-green-500/10 text-green-600 border-green-500/20' },
  warning: { from: 'from-orange-500/20', to: 'to-orange-500/10', badge: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  danger: { from: 'from-red-500/20', to: 'to-red-500/10', badge: 'bg-red-500/10 text-red-600 border-red-500/20' },
};

export const AnnouncementsTab: React.FC = () => {
  const [iesList, setIesList] = useState<IES[]>([]);
  const [searchIes, setSearchIes] = useState('');
  const [config, setConfig] = useState<AnnouncementConfig>({
    titulo: 'Avisos Importantes',
    descricao: 'Fique por dentro das últimas atualizações, novos conteúdos e informações importantes sobre sua jornada de estudos.',
    link_botao: '',
    texto_botao: 'Ver todos os avisos',
    paleta_cores: 'primary',
    ativo: true,
    data_expiracao: null,
    prioridade: 'media',
    visibilidade: 'todas',
    ies_selecionadas: [],
    ies_excluidas: [],
  });

  useEffect(() => {
    fetchIesList();
    fetchActiveAnnouncement();
  }, []);

  const fetchIesList = async () => {
    const { data, error } = await supabase
      .from('ies')
      .select('id, nome')
      .order('nome');
    
    if (!error && data) {
      setIesList(data);
    }
  };

  const fetchActiveAnnouncement = async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('ativo', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (!error && data) {
      setConfig({
        id: data.id,
        titulo: data.titulo,
        descricao: data.descricao,
        link_botao: data.link_botao || '',
        texto_botao: data.texto_botao,
        paleta_cores: data.paleta_cores,
        ativo: data.ativo,
        data_expiracao: data.data_expiracao,
        prioridade: data.prioridade as 'baixa' | 'media' | 'alta',
        visibilidade: data.visibilidade as 'todas' | 'seletivo' | 'exceto',
        ies_selecionadas: data.ies_selecionadas || [],
        ies_excluidas: data.ies_excluidas || [],
      });
    }
  };

  const handleSave = async () => {
    const { error } = await supabase
      .from('announcements')
      .upsert({
        id: config.id,
        titulo: config.titulo,
        descricao: config.descricao,
        link_botao: config.link_botao || null,
        texto_botao: config.texto_botao,
        paleta_cores: config.paleta_cores,
        ativo: config.ativo,
        data_expiracao: config.data_expiracao,
        prioridade: config.prioridade,
        visibilidade: config.visibilidade,
        ies_selecionadas: config.ies_selecionadas,
        ies_excluidas: config.ies_excluidas,
      });

    if (error) {
      toast.error('Erro ao salvar aviso');
      console.error(error);
    } else {
      toast.success('Aviso salvo com sucesso!');
      if (!config.id) {
        fetchActiveAnnouncement();
      }
    }
  };

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

  const palette = colorPalettes[config.paleta_cores as keyof typeof colorPalettes] || colorPalettes.primary;

  return (
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
            <Card className={`border-0 bg-gradient-to-br ${palette.from} ${palette.to} shadow-lg`}>
              <div className="absolute top-4 right-4 z-10">
                <Badge variant="default" className={palette.badge}>
                  <Bell className="h-3 w-3 mr-1" />
                  Novo
                </Badge>
              </div>

              <CardHeader className="pb-4 space-y-2">
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-12 h-12 bg-gradient-to-br ${palette.from} ${palette.to} rounded-xl flex items-center justify-center ring-1 ring-primary/10`}>
                    <Bell className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <CardTitle className="text-xl font-semibold leading-tight">
                      {config.titulo}
                    </CardTitle>
                  </div>
                </div>
                <div className="h-px bg-gradient-to-r from-border via-border/50 to-transparent" />
              </CardHeader>

              <CardContent className="space-y-6">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {config.descricao}
                </p>
                <Button className="w-full">
                  {config.texto_botao}
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
                placeholder="https://..."
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
                  <SelectItem value="primary">Azul/Roxo (Premium)</SelectItem>
                  <SelectItem value="success">Verde (Sucesso)</SelectItem>
                  <SelectItem value="warning">Laranja (Alerta)</SelectItem>
                  <SelectItem value="danger">Vermelho (Urgente)</SelectItem>
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
                value={config.data_expiracao || ''}
                onChange={(e) => setConfig({ ...config, data_expiracao: e.target.value || null })}
              />
            </div>

            <Button onClick={handleSave} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              Salvar Aviso
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
