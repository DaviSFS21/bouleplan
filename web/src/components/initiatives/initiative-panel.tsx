'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useUpdateInitiative, type InitiativeChanges } from '@/api/initiatives';
import { BLANK_NAME_MESSAGE, updateInitiativeMessage, type InitiativeField } from '@/api/messages';
import type { Initiative } from '@/api/types';
import { ActionMenu } from '@/components/action-menu/action-menu';
import { ColorPicker, colorName, type ColorToken } from '@/components/color-picker/color-picker';
import { DeadlineField, localToday } from '@/components/deadline-field/deadline-field';
import { InlineText } from '@/components/inline-text/inline-text';
import { SidePanel } from '@/components/side-panel/side-panel';
import { formatDate, formatElapsed } from './initiative-dates';
import styles from './initiative-panel.module.css';

const NAME_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 10_000;

export type PanelIntent = 'name' | 'color' | null;

export interface PanelRequest {
  intent: PanelIntent;
  id: number;
}

interface InitiativePanelProps {
  initiative: Initiative;
  request: PanelRequest;
  onClose: () => void;
  onArchive: () => void;
  onDelete: () => void;
  now?: Date;
}

export function InitiativePanel({
  initiative,
  request,
  onClose,
  onArchive,
  onDelete,
  now,
}: Readonly<InitiativePanelProps>) {
  const update = useUpdateInitiative();
  const [errors, setErrors] = useState<Partial<Record<InitiativeField, string>>>({});
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [nameFocus, setNameFocus] = useState(0);
  const [handledRequest, setHandledRequest] = useState<number | null>(null);
  const colorButton = useRef<HTMLButtonElement>(null);
  const palette = useRef<HTMLDivElement>(null);
  const clock = now ?? new Date();

  if (request.id !== handledRequest) {
    setHandledRequest(request.id);
    if (request.intent === 'name') setNameFocus((signal) => signal + 1);
    if (request.intent === 'color') setPaletteOpen(true);
  }

  async function save(field: InitiativeField, changes: InitiativeChanges) {
    setErrors((current) => ({ ...current, [field]: undefined }));
    try {
      await update.mutateAsync({ id: initiative.id, changes });
    } catch (failure) {
      setErrors((current) => ({ ...current, [field]: updateInitiativeMessage(failure, field) }));
    }
  }

  useEffect(() => {
    if (paletteOpen) {
      palette.current?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]')?.focus();
    }
  }, [paletteOpen]);

  function closePalette() {
    setPaletteOpen(false);
    colorButton.current?.focus();
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
      onClose={onClose}
    >
      <InlineText
        label="Nome da iniciativa"
        variant="title"
        value={initiative.name}
        maxLength={NAME_MAX_LENGTH}
        focusSignal={nameFocus}
        error={errors.name}
        validate={(text) => (text.trim() === '' ? BLANK_NAME_MESSAGE : null)}
        onCommit={(text) => {
          const name = text.trim();
          if (name !== initiative.name) void save('name', { name });
        }}
      />
      <div className={styles.props}>
        <span className={styles.label}>Cor</span>
        <button
          ref={colorButton}
          type="button"
          className={styles.value}
          aria-expanded={paletteOpen}
          onClick={() => {
            setPaletteOpen((open) => !open);
          }}
        >
          <span
            className={styles.dot}
            style={{ '--ini': `var(--ini-${initiative.color})` } as CSSProperties}
            aria-hidden="true"
          />
          {colorName(initiative.color)}
        </button>
        {paletteOpen ? (
          <div
            ref={palette}
            className={styles.palette}
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return;
              event.stopPropagation();
              closePalette();
            }}
          >
            <ColorPicker
              label="Cor da iniciativa"
              value={initiative.color}
              onChange={(color: ColorToken) => {
                if (color !== initiative.color) void save('color', { color });
              }}
              onChoose={closePalette}
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
          label="Descrição"
          multiline
          value={initiative.description ?? ''}
          maxLength={DESCRIPTION_MAX_LENGTH}
          placeholder="Adicionar descrição"
          error={errors.description}
          onCommit={(text) => {
            void save('description', { description: text.trim() === '' ? null : text });
          }}
        />
      </section>
    </SidePanel>
  );
}
