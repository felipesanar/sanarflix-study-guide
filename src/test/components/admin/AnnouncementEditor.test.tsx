import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render } from '../../utils';
import { AnnouncementEditor } from '@/components/admin/announcements/AnnouncementEditor';

describe('AnnouncementEditor', () => {
  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();
  const mockSetConfig = vi.fn();
  const mockSetSearchIes = vi.fn();
  
  const mockIES = [
    { id: 'ies-1', nome: 'USCS' },
    { id: 'ies-2', nome: 'UNIFESP' }
  ];

  const mockConfig = {
    titulo: 'Aviso de Teste',
    descricao: 'Esta é uma descrição de teste',
    link_botao: 'https://test.com',
    texto_botao: 'Clique aqui',
    paleta_cores: 'primary',
    ativo: true,
    data_expiracao: null,
    prioridade: 'media' as const,
    visibilidade: 'todas' as const,
    ies_selecionadas: [],
    ies_excluidas: []
  };

  const emptyConfig = {
    titulo: '',
    descricao: '',
    link_botao: '',
    texto_botao: '',
    paleta_cores: 'primary',
    ativo: true,
    data_expiracao: null,
    prioridade: 'media' as const,
    visibilidade: 'todas' as const,
    ies_selecionadas: [],
    ies_excluidas: []
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render announcement editor correctly', () => {
    render(
      <AnnouncementEditor
        config={emptyConfig}
        setConfig={mockSetConfig}
        iesList={mockIES}
        searchIes=""
        setSearchIes={mockSetSearchIes}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );
    
    expect(screen.getByPlaceholderText(/Título do aviso/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Descrição detalhada/i)).toBeInTheDocument();
  });

  it('should display form with pre-filled values', () => {
    render(
      <AnnouncementEditor
        config={mockConfig}
        setConfig={mockSetConfig}
        iesList={mockIES}
        searchIes=""
        setSearchIes={mockSetSearchIes}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );
    
    expect(screen.getByDisplayValue('Aviso de Teste')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Esta é uma descrição de teste')).toBeInTheDocument();
  });

  it('should call setConfig when title is changed', () => {
    render(
      <AnnouncementEditor
        config={emptyConfig}
        setConfig={mockSetConfig}
        iesList={mockIES}
        searchIes=""
        setSearchIes={mockSetSearchIes}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );
    
    const titleInput = screen.getByPlaceholderText(/Título do aviso/i);
    fireEvent.change(titleInput, { target: { value: 'Novo Título' } });
    
    expect(mockSetConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        titulo: 'Novo Título'
      })
    );
  });

  it('should call onSave when save button is clicked', async () => {
    render(
      <AnnouncementEditor
        config={mockConfig}
        setConfig={mockSetConfig}
        iesList={mockIES}
        searchIes=""
        setSearchIes={mockSetSearchIes}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );
    
    const saveButton = screen.getByRole('button', { name: /Salvar Aviso/i });
    fireEvent.click(saveButton);
    
    expect(mockOnSave).toHaveBeenCalledWith(mockConfig);
  });

  it('should call onCancel when cancel button is clicked', () => {
    render(
      <AnnouncementEditor
        config={emptyConfig}
        setConfig={mockSetConfig}
        iesList={mockIES}
        searchIes=""
        setSearchIes={mockSetSearchIes}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );
    
    const cancelButton = screen.getByRole('button', { name: /Cancelar/i });
    fireEvent.click(cancelButton);
    
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should toggle active status switch', () => {
    render(
      <AnnouncementEditor
        config={mockConfig}
        setConfig={mockSetConfig}
        iesList={mockIES}
        searchIes=""
        setSearchIes={mockSetSearchIes}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );
    
    const activeSwitch = screen.getByRole('switch');
    fireEvent.click(activeSwitch);
    
    expect(mockSetConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        ativo: false
      })
    );
  });

  it('should display all priority options', () => {
    render(
      <AnnouncementEditor
        config={emptyConfig}
        setConfig={mockSetConfig}
        iesList={mockIES}
        searchIes=""
        setSearchIes={mockSetSearchIes}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );
    
    expect(screen.getByText(/Prioridade/i)).toBeInTheDocument();
  });

  it('should display color palette options', () => {
    render(
      <AnnouncementEditor
        config={emptyConfig}
        setConfig={mockSetConfig}
        iesList={mockIES}
        searchIes=""
        setSearchIes={mockSetSearchIes}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );
    
    expect(screen.getByText(/Paleta de Cores/i)).toBeInTheDocument();
  });

  it('should show IES list when visibility is seletivo', () => {
    const configWithSelective = {
      ...emptyConfig,
      visibilidade: 'seletivo' as const
    };

    render(
      <AnnouncementEditor
        config={configWithSelective}
        setConfig={mockSetConfig}
        iesList={mockIES}
        searchIes=""
        setSearchIes={mockSetSearchIes}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );
    
    expect(screen.getByText(/Selecionar IES/i)).toBeInTheDocument();
  });

  it('should show preview section', () => {
    render(
      <AnnouncementEditor
        config={mockConfig}
        setConfig={mockSetConfig}
        iesList={mockIES}
        searchIes=""
        setSearchIes={mockSetSearchIes}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );
    
    expect(screen.getByText(/Pré-visualização/i)).toBeInTheDocument();
  });

  it('should update search when searching for IES', () => {
    const configWithSelective = {
      ...emptyConfig,
      visibilidade: 'seletivo' as const
    };

    render(
      <AnnouncementEditor
        config={configWithSelective}
        setConfig={mockSetConfig}
        iesList={mockIES}
        searchIes=""
        setSearchIes={mockSetSearchIes}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );
    
    const searchInput = screen.getByPlaceholderText(/Buscar IES/i);
    fireEvent.change(searchInput, { target: { value: 'USCS' } });
    
    expect(mockSetSearchIes).toHaveBeenCalledWith('USCS');
  });
});
