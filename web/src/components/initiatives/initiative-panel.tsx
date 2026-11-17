'use client';

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { useUpdateInitiative, type InitiativeChanges } from '@/api/initiatives';
import {
  BLANK_NAME_MESSAGE,
  BLANK_PHASE_NAME_MESSAGE,
  createPhaseMessage,
  SAVE_FAILED_MESSAGES,
  updateInitiativeMessage,
  type InitiativeField,
} from '@/api/messages';
import type { Initiative, Phase } from '@/api/types';
import { ActionMenu } from '@/components/action-menu/action-menu';
import { ColorPicker, colorName, type ColorToken } from '@/components/color-picker/color-picker';
import { DeadlineField, localToday } from '@/components/deadline-field/deadline-field';
import { InlineText } from '@/components/inline-text/inline-text';
import { SidePanel } from '@/components/side-panel/side-panel';
import { formatDate, formatElapsed } from './initiative-dates';
import { phaseLabel } from './phase-label';
import { QuickCreateField } from './quick-create-field';
import styles from './initiative-panel.module.css';

const NAME_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 10_000;

export type PanelIntent = 'name' | 'color' | null;

export interface PanelRequest {
  intent: PanelIntent;
  id: number;
  target: string;
}

interface InitiativePanelProps {
  initiative: Initiative;
  phases: readonly Phase[] | undefined;
  selectedPhaseId: string | null;
  onSelectPhase: (id: string | null) => void;
  onCreatePhase: (name: string) => Promise<void>;
  opener: RefObject<HTMLElement | null>;
  fallbackFocus: () => HTMLElement | null;
  request: PanelRequest | null;
  onRequestHandled: () => void;
  onClose: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onSaved: () => void;
  onSaveFailed: (message: string) => void;
  now?: Date;
}

export function InitiativePanel({
  initiative,
  phases,
  selectedPhaseId,
  onSelectPhase,
  onCreatePhase,
  opener,
  fallbackFocus,
  request,
  onRequestHandled,
  onClose,
  onArchive,
  onDelete,
  onSaved,
  onSaveFailed,
  now,
}: Readonly<InitiativePanelProps>) {
  const update = useUpdateInitiative();
  const [errors, setErrors] = useState<Partial<Record<InitiativeField, string>>>({});
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pendingColor, setPendingColor] = useState<ColorToken | null>(null);
  const [nameFocus, setNameFocus] = useState(0);
  const [handledRequest, setHandledRequest] = useState<number | null>(null);
  const [boundId, setBoundId] = useState(initiative.id);
  const colorButton = useRef<HTMLButtonElement>(null);
  const palette = useRef<HTMLDivElement>(null);
  const live = useRef({ mounted: true, id: initiative.id });
  const clock = now ?? new Date();
  const color = pendingColor ?? initiative.color;

  if (boundId !== initiative.id) {
    setBoundId(initiative.id);
    setErrors({});
    setPaletteOpen(false);
    setPendingColor(null);
    setNameFocus(0);
  }

  const pending = request?.target === initiative.id ? request : null;
  if (pending && pending.id !== handledRequest) {
    setHandledRequest(pending.id);
    if (pending.intent === 'name') setNameFocus((signal) => signal + 1);
    if (pending.intent === 'color') setPaletteOpen(true);
  }

  useEffect(() => {
    live.current = { mounted: true, id: initiative.id };
    return () => {
      live.current.mounted = false;
    };
  }, [initiative.id]);

  useEffect(() => {
    if (pending) onRequestHandled();
  }, [pending, onRequestHandled]);

  useEffect(() => {
    if (paletteOpen) {
      palette.current?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]')?.focus();
    }
  }, [paletteOpen]);

  async function save(field: InitiativeField, changes: InitiativeChanges) {
    const id = initiative.id;
    setErrors((current) => ({ ...current, [field]: undefined }));
    try {
      await update.mutateAsync({ id, changes });
      onSaved();
    } catch (failure) {
      if (live.current.mounted && live.current.id === id) {
        setErrors((current) => ({ ...current, [field]: updateInitiativeMessage(failure, field) }));
      } else {
        onSaveFailed(SAVE_FAILED_MESSAGES[field]);
      }
    } finally {
      if (field === 'color' && live.current.id === id) setPendingColor(null);
    }
  }

  function closePalette(returnFocus: boolean) {
    setPaletteOpen(false);
    if (returnFocus) colorButton.current?.focus();
  }

  function editName() {
    setNameFocus((signal) => signal + 1);
  }

  const menu = (
    <ActionMenu
      label="Ações da iniciativa"
      items={[
        { label: 'Editar nome', onSelect: editName },
        {
          label: 'Cor…',
          onSelect: () => {
            setPaletteOpen(true);
          },
        },
        { separator: true },
        { label: 'Arquivar', onSelect: onArchive },
        { label: 'Excluir', onSelect: onDelete },
      ]}
    />
  );

  const footer = `Criada em ${formatDate(initiative.createdAt, clock)} · alterada ${formatElapsed(initiative.updatedAt, clock)} · salva automaticamente`;

  return (
    <SidePanel
      label="Iniciativa"
      eyebrow="Iniciativa"
      actions={menu}
      footer={footer}
      opener={opener}
      fallbackFocus={fallbackFocus}
      onClose={onClose}
    >
      <InlineText
        key={`name-${initiative.id}`}
        label="Nome da iniciativa"
        variant="title"
        value={initiative.name}
        maxLength={NAME_MAX_LENGTH}
        focusSignal={nameFocus}
        trim
        error={errors.name}
        validate={(text) => (text === '' ? BLANK_NAME_MESSAGE : null)}
        onCommit={(name) => {
          void save('name', { name });
        }}
      />
      <div className={styles.props}>
        <span className={styles.label}>Cor</span>
        <button
          ref={colorButton}
          type="button"
          className={styles.value}
          aria-expanded={paletteOpen}
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          onClick={() => {
            setPaletteOpen((open) => !open);
          }}
        >
          <span
            className={styles.dot}
            style={{ '--ini': `var(--ini-${color})` } as CSSProperties}
            aria-hidden="true"
          />
          {colorName(color)}
        </button>
        {paletteOpen ? (
          <div ref={palette} className={styles.palette}>
            <ColorPicker
              label="Cor da iniciativa"
              value={color}
              onChange={(chosen) => {
                closePalette(true);
                if (chosen === initiative.color) return;
                setPendingColor(chosen);
                void save('color', { color: chosen });
              }}
              onCancel={(reason) => {
                closePalette(reason === 'escape');
              }}
            />
          </div>
        ) : null}
        {errors.color ? (
          <p role="alert" className={styles.error}>
            {errors.color}
          </p>
        ) : null}
        <span className={styles.label}>Prazo geral</span>
        <DeadlineField
          key={`deadline-${initiative.id}`}
          label="Prazo geral"
          value={initiative.overallDeadline}
          today={localToday(clock)}
          onChange={(overallDeadline) => {
            void save('overallDeadline', { overallDeadline });
          }}
        />
        {errors.overallDeadline ? (
          <p role="alert" className={styles.error}>
            {errors.overallDeadline}
          </p>
        ) : null}
        <span className={styles.label}>Progresso</span>
        <span className={styles.meta}>sem tarefas ainda</span>
      </div>
      <section className={styles.section}>
        <h2 className={styles.eyebrow}>Descrição</h2>
        <InlineText
          key={`description-${initiative.id}`}
          label="Descrição"
          multiline
          value={initiative.description ?? ''}
          maxLength={DESCRIPTION_MAX_LENGTH}
          placeholder="Adicionar descrição"
          trim
          error={errors.description}
          onCommit={(text) => {
            void save('description', { description: text === '' ? null : text });
          }}
        />
      </section>
      <section className={styles.section}>
        <h2 className={styles.eyebrow}>Fases</h2>
        {phases ? (
          <ul className={styles.phases}>
            {phases.map((phase, position) => (
              <li key={phase.id}>
                <button
                  type="button"
                  className={styles.phase}
                  aria-pressed={selectedPhaseId === phase.id}
                  onClick={() => {
                    onSelectPhase(selectedPhaseId === phase.id ? null : phase.id);
                  }}
                >
                  {phaseLabel(position, phase.name)}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {phases?.length === 0 ? <p className={styles.meta}>Nenhuma fase ainda.</p> : null}
        <QuickCreateField
          key={initiative.id}
          triggerLabel="+ Nova fase"
          inputLabel="Nome da nova fase"
          placeholder="Nome da fase"
          blankMessage={BLANK_PHASE_NAME_MESSAGE}
          errorMessage={createPhaseMessage}
          onCreate={onCreatePhase}
          keepOpen
        />
      </section>
    </SidePanel>
  );
}
