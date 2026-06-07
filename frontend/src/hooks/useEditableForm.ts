import { useState } from 'react';

export interface UseEditableFormOptions<TForm, TDTO> {
  editableStatuses: string[];
  currentStatus: string | undefined;
  initialForm: TForm;
  fromDTO: (dto: TDTO) => TForm;
  save: (form: TForm) => Promise<TDTO>;
  validate?: (form: TForm) => string | null;
}

export interface UseEditableFormReturn<TForm, TDTO> {
  form: TForm;
  setForm: React.Dispatch<React.SetStateAction<TForm>>;
  isReadOnly: boolean;
  isSaving: boolean;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  handleSave: () => Promise<TDTO | null>;
}

export function useEditableForm<TForm, TDTO>(
  opts: UseEditableFormOptions<TForm, TDTO>
): UseEditableFormReturn<TForm, TDTO> {
  const [form, setForm] = useState<TForm>(opts.initialForm);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isReadOnly = !opts.editableStatuses.includes(opts.currentStatus ?? '');

  const handleSave = async (): Promise<TDTO | null> => {
    if (opts.validate) {
      const validationError = opts.validate(form);
      if (validationError) {
        setError(validationError);
        return null;
      }
    }

    try {
      setIsSaving(true);
      setError(null);
      const dto = await opts.save(form);
      const updatedForm = opts.fromDTO(dto);
      setForm(updatedForm);
      return dto;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred while saving';
      setError(errorMessage);
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    form,
    setForm,
    isReadOnly,
    isSaving,
    error,
    setError,
    handleSave,
  };
}
