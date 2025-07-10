
import React, { useState } from 'react';
import { StudyContentCard } from '@/components/StudyContentCard';
import { StudyFilters } from '@/components/StudyFilters';
import { ProgressCard } from '@/components/ProgressCard';
import { useStudy } from '@/contexts/StudyContext';
import { useAuth } from '@/contexts/AuthContext';
import { BookOpen, Target, TrendingUp, Award } from 'lucide-react';

export const StudyGuide: React.FC = () => {
  const { user } = useAuth();
  const { getFilteredContents, progress } = useStudy();
  const [selectedDiscipline, setSelectedDiscipline] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const filteredContents = getFilteredContents(
    selectedDiscipline === 'all' ? undefined : selectedDiscipline,
    selectedStatus === 'all' ? undefined : (selectedStatus as 'completed' | 'pending')
  );

  const handleResetFilters = () => {
    setSelectedDiscipline('all');
    setSelectedStatus('all');
  };

  const totalCompleted = progress.completedItems.length;
  const totalProgress = progress.totalItems > 0 ? Math.round((totalCompleted / progress.totalItems) * 100) : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary-100 rounded-lg">
            <BookOpen className="h-6 w-6 text-primary-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Guia de Estudos</h1>
            <p className="text-gray-600">
              {user?.faculty} - {user?.semester}º período
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <ProgressCard
            title="Progresso Geral"
            current={totalCompleted}
            total={progress.totalItems}
            percentage={totalProgress}
            color="primary"
            icon={<Target className="h-4 w-4" />}
          />
          
          {Object.entries(progress.progressByDiscipline).slice(0, 3).map(([discipline, data]) => (
            <ProgressCard
              key={discipline}
              title={discipline}
              current={data.completed}
              total={data.total}
              percentage={data.percentage}
              color={data.percentage === 100 ? 'success' : 'primary'}
              icon={<TrendingUp className="h-4 w-4" />}
            />
          ))}
        </div>
      </div>

      {/* Filters */}
      <StudyFilters
        selectedDiscipline={selectedDiscipline}
        selectedStatus={selectedStatus}
        onDisciplineChange={setSelectedDiscipline}
        onStatusChange={setSelectedStatus}
        onReset={handleResetFilters}
      />

      {/* Content List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Conteúdos de Estudo
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({filteredContents.length} {filteredContents.length === 1 ? 'item' : 'itens'})
            </span>
          </h2>
          
          {totalCompleted > 0 && (
            <div className="flex items-center gap-2 text-success-600">
              <Award className="h-4 w-4" />
              <span className="text-sm font-medium">
                {totalCompleted} concluído{totalCompleted !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {filteredContents.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhum conteúdo encontrado
            </h3>
            <p className="text-gray-600 mb-4">
              Tente ajustar os filtros para ver mais conteúdos.
            </p>
            {(selectedDiscipline !== 'all' || selectedStatus !== 'all') && (
              <button
                onClick={handleResetFilters}
                className="text-primary-600 hover:text-primary-700 font-medium text-sm"
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredContents.map((content) => (
              <StudyContentCard key={content.id} content={content} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
