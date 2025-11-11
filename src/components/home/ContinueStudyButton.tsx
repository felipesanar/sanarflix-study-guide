import { Button } from '@/components/ui/button';
import { PlayCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useState } from 'react';

interface ContinueStudyButtonProps {
  hasStudyGuide: boolean;
  hasCronograma: boolean;
}

export const ContinueStudyButton = ({ hasStudyGuide, hasCronograma }: ContinueStudyButtonProps) => {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  const handleClick = () => {
    if (hasStudyGuide) {
      navigate('/study-guide');
    } else if (hasCronograma) {
      navigate('/cronograma-enamed');
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Button
          onClick={handleClick}
          size="lg"
          className="w-full bg-gradient-to-r from-uscs-blue to-uscs-blue-dark text-white shadow-lg hover:shadow-xl transition-all"
        >
          <PlayCircle className="mr-2 h-5 w-5 animate-pulse" />
          <div className="text-left">
            <div className="font-semibold">Continuar Estudos</div>
            <div className="text-xs opacity-90">Continuar de onde parou ontem</div>
          </div>
        </Button>
      </motion.div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure seu plano de estudos</DialogTitle>
            <DialogDescription>
              Você ainda não tem um guia de estudos ou cronograma configurado. 
              Monte seu plano de estudos agora para começar sua jornada!
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button onClick={() => navigate('/study-guide')}>
              Configurar Guia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
