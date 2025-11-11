import { motion } from 'framer-motion';
import { Sun, Moon, BookOpen } from 'lucide-react';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Bom dia', icon: Sun };
  if (hour < 18) return { text: 'Boa tarde', icon: Sun };
  return { text: 'Boa noite', icon: Moon };
};

interface WelcomeBannerProps {
  userName: string;
}

export const WelcomeBanner = ({ userName }: WelcomeBannerProps) => {
  const { text, icon: Icon } = getGreeting();
  const firstName = userName?.split(' ')[0] || 'Estudante';

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-primary via-primary-dark to-uscs-blue rounded-2xl p-6 md:p-8 text-white shadow-lg"
    >
      <div className="flex items-center gap-3 mb-2">
        <Icon className="h-6 w-6" />
        <h1 className="text-2xl md:text-3xl font-bold">{text}, {firstName}!</h1>
      </div>
      <div className="flex items-center gap-2 text-white/90">
        <BookOpen className="h-5 w-5" />
        <p className="text-lg">Pronto para estudar hoje?</p>
      </div>
    </motion.div>
  );
};
