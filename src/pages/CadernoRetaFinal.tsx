import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Flag, Loader2, CalendarDays, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { useRetaFinalPlan } from '@/hooks/useRetaFinalPlan';

const DEFAULT_DAYS = 30;

export const CadernoRetaFinal: React.FC = () => {
  const navigate = useNavigate();
  const [days, setDays] = useState(DEFAULT_DAYS);
  const { days: plan, ranked, loading } = useRetaFinalPlan(days);

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/caderno-de-erros')} className="gap-2 -ml-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Flag className="h-4 w-4 text-primary" /> Reta Final
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Plano de Reta Final</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Suas questões priorizadas por urgência e peso, distribuídas até a prova.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="days" className="text-xs flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Dias até a prova</Label>
            <Input
              id="days"
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
              className="w-28 h-9"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            {ranked.length} questões no plano · ~{Math.ceil(ranked.length / days)} por dia
          </div>
          <Button onClick={() => navigate('/caderno-de-erros/revisao')} className="ml-auto gap-2">
            <Brain className="h-4 w-4" /> Revisar agora
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : ranked.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-5">
            <Flag className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1.5">Caderno vazio</h3>
          <p className="text-sm text-muted-foreground max-w-sm">Adicione erros ao caderno para montar seu plano de reta final.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {plan.map((d) => (
            <motion.div key={d.day} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: Math.min(d.day * 0.02, 0.2) }}>
              <Card>
                <CardContent className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">Dia {d.day}</h3>
                    <span className="text-xs text-muted-foreground">{d.items.length} questões</span>
                  </div>
                  <div className="space-y-1.5">
                    {d.items.map((it) => (
                      <div key={it.entry.id} className="flex items-center gap-2 text-sm">
                        {it.entry.grandeArea && <Badge variant="outline" className="text-[11px]">{it.entry.grandeArea}</Badge>}
                        <span className="text-muted-foreground truncate">{it.entry.tema || 'Sem tema'}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CadernoRetaFinal;
