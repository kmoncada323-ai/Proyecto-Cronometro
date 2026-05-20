/**
 * Cronómetros Simultáneos — script.js
 * Arquitectura: módulo IIFE + estado centralizado + funciones puras.
 * El Event Loop de JavaScript gestiona los 3 setInterval de forma
 * concurrente sin bloquear el hilo principal.
 */

(function () {
  'use strict';

  /* ────────────────────────────────────────────
     ESTADO GLOBAL
     Cada cronómetro tiene su propia ranura en el
     array TIMERS_STATE, aislando completamente su
     ciclo de vida.
  ──────────────────────────────────────────── */
  const TIMER_COUNT = 3;

  const createInitialTimerState = () => ({
    intervalId: null,   // ID devuelto por setInterval
    elapsed: 0,         // segundos transcurridos
    target: 0,          // segundos configurados por el usuario
    isRunning: false,
    isDone: false,
  });

  const timersState = Array.from({ length: TIMER_COUNT }, createInitialTimerState);

  /* ────────────────────────────────────────────
     REFERENCIAS AL DOM
  ──────────────────────────────────────────── */
  const domRefs = {
    cards:          Array.from(document.querySelectorAll('.timer-card')),
    elapsedSpans:   Array.from({ length: TIMER_COUNT }, (_, i) => document.getElementById(`elapsed-${i}`)),
    targetSpans:    Array.from({ length: TIMER_COUNT }, (_, i) => document.getElementById(`target-display-${i}`)),
    statusSpans:    Array.from({ length: TIMER_COUNT }, (_, i) => document.getElementById(`status-${i}`)),
    progressBars:   Array.from({ length: TIMER_COUNT }, (_, i) => document.getElementById(`bar-${i}`)),
    inputs:         Array.from({ length: TIMER_COUNT }, (_, i) => document.getElementById(`input-${i}`)),
    errorSpans:     Array.from({ length: TIMER_COUNT }, (_, i) => document.getElementById(`error-${i}`)),
    btnPlay:        document.getElementById('btn-play'),
    btnPause:       document.getElementById('btn-pause'),
    btnReset:       document.getElementById('btn-reset'),
  };

  /* ────────────────────────────────────────────
     VALIDACIÓN DE INPUTS
     Devuelve { valid: bool, value: number, message: string }
  ──────────────────────────────────────────── */
  const validateInput = (rawValue) => {
    const trimmed = rawValue.trim();

    if (trimmed === '') {
      return { valid: false, value: 0, message: 'Campo requerido' };
    }

    const parsed = Number(trimmed);

    if (isNaN(parsed) || trimmed === '') {
      return { valid: false, value: 0, message: 'Solo se permiten números' };
    }

    if (!Number.isInteger(parsed)) {
      return { valid: false, value: 0, message: 'Solo números enteros' };
    }

    if (parsed <= 0) {
      return { valid: false, value: 0, message: 'Debe ser mayor a 0' };
    }

    return { valid: true, value: parsed, message: '' };
  };

  /* ────────────────────────────────────────────
     ACTUALIZACIÓN DEL DOM
     Funciones puras de presentación: reciben datos
     y actualizan exactamente un elemento del DOM.
  ──────────────────────────────────────────── */
  const updateElapsedDisplay = (id, elapsed) => {
    domRefs.elapsedSpans[id].textContent = String(elapsed).padStart(2, '0');
  };

  const updateTargetDisplay = (id, target) => {
    domRefs.targetSpans[id].textContent = target > 0 ? String(target).padStart(2, '0') : '--';
  };

  const updateProgressBar = (id, elapsed, target) => {
    const percentage = target > 0 ? Math.min((elapsed / target) * 100, 100) : 0;
    domRefs.progressBars[id].style.width = `${percentage}%`;
  };

  const updateStatusDisplay = (id, isRunning, isDone) => {
    const statusEl = domRefs.statusSpans[id];
    if (isDone) {
      statusEl.textContent = 'Completado';
    } else if (isRunning) {
      statusEl.textContent = 'Ejecutándose';
    } else {
      statusEl.textContent = 'En pausa';
    }
  };

  const updateCardClasses = (id, isRunning, isDone) => {
    const card = domRefs.cards[id];
    card.classList.toggle('is-running', isRunning && !isDone);
    card.classList.toggle('is-done', isDone);
  };

  const showInputError = (id, message) => {
    domRefs.errorSpans[id].textContent = message;
    domRefs.inputs[id].classList.add('has-error');
  };

  const clearInputError = (id) => {
    domRefs.errorSpans[id].textContent = '';
    domRefs.inputs[id].classList.remove('has-error');
  };

  /**
   * Sincroniza todos los elementos visuales de un cronómetro
   * con su estado actual. Punto único de verdad para el DOM.
   */
  const syncTimerDOM = (id) => {
    const state = timersState[id];
    updateElapsedDisplay(id, state.elapsed);
    updateTargetDisplay(id, state.target);
    updateProgressBar(id, state.elapsed, state.target);
    updateStatusDisplay(id, state.isRunning, state.isDone);
    updateCardClasses(id, state.isRunning, state.isDone);
  };

  /* ────────────────────────────────────────────
     LÓGICA DEL CRONÓMETRO
  ──────────────────────────────────────────── */

  /**
   * Tick de un cronómetro individual.
   * Es el callback que el Event Loop ejecuta cada segundo
   * por cada setInterval activo.
   */
  const tickTimer = (id) => {
    const state = timersState[id];
    state.elapsed += 1;

    if (state.elapsed >= state.target) {
      state.elapsed = state.target;
      stopTimer(id, true); // detenemos y marcamos como terminado
    }

    syncTimerDOM(id);
  };

  /**
   * Inicia el intervalo de un cronómetro.
   * El setInterval devuelve un ID único al entorno del navegador
   * que se almacena en el estado para poder cancelarlo después.
   */
  const startTimer = (id) => {
    const state = timersState[id];

    if (state.isRunning || state.isDone) return;

    const validation = validateInput(domRefs.inputs[id].value);
    if (!validation.valid) {
      showInputError(id, validation.message);
      return false; // señal de error al caller
    }

    clearInputError(id);
    state.target  = validation.value;
    state.isRunning = true;

    // El Event Loop programará este callback cada 1000ms
    state.intervalId = setInterval(() => tickTimer(id), 1000);

    syncTimerDOM(id);
    return true;
  };

  /**
   * Detiene el intervalo de un cronómetro.
   * clearInterval cancela el timer específico usando su ID,
   * sin afectar a los demás intervalos activos.
   */
  const stopTimer = (id, isDone = false) => {
    const state = timersState[id];

    if (state.intervalId !== null) {
      clearInterval(state.intervalId);
      state.intervalId = null;
    }

    state.isRunning = false;
    state.isDone = isDone;

    syncTimerDOM(id);
  };

  /**
   * Reinicia un cronómetro a su estado inicial.
   */
  const resetTimer = (id) => {
    stopTimer(id, false);
    const state = timersState[id];
    state.elapsed = 0;
    state.target  = 0;
    state.isDone  = false;
    clearInputError(id);
    syncTimerDOM(id);
  };

  /* ────────────────────────────────────────────
     CONTROLES GLOBALES
     Iteran sobre los 3 cronómetros usando el
     mismo conjunto de funciones unitarias.
  ──────────────────────────────────────────── */

  /**
   * Inicia todos los cronómetros simultáneamente.
   * Valida cada input antes de lanzar; si alguno falla,
   * no inicia ninguno — coherencia de estado global.
   */
  const handlePlayAll = () => {
    // Fase 1: validar todos los inputs antes de iniciar cualquiera
    const validations = domRefs.inputs.map((input, id) => {
      const state = timersState[id];
      if (state.isRunning || state.isDone) return { skip: true };
      return { id, ...validateInput(input.value) };
    });

    let hasError = false;

    validations.forEach((result) => {
      if (result.skip) return;
      if (!result.valid) {
        showInputError(result.id, result.message);
        hasError = true;
      } else {
        clearInputError(result.id);
      }
    });

    if (hasError) return;

    // Fase 2: iniciar todos si no hay errores
    validations.forEach((result) => {
      if (result.skip) return;
      startTimer(result.id);
    });
  };

  const handlePauseAll = () => {
    for (let id = 0; id < TIMER_COUNT; id++) {
      stopTimer(id, false);
    }
  };

  const handleResetAll = () => {
    for (let id = 0; id < TIMER_COUNT; id++) {
      resetTimer(id);
      domRefs.inputs[id].value = '';
    }
  };

  /* ────────────────────────────────────────────
     EVENT LISTENERS
     Centraliza el manejo de eventos usando
     addEventListener (sin inline handlers).
  ──────────────────────────────────────────── */
  const bindGlobalControls = () => {
    domRefs.btnPlay.addEventListener('click', handlePlayAll);
    domRefs.btnPause.addEventListener('click', handlePauseAll);
    domRefs.btnReset.addEventListener('click', handleResetAll);
  };

  /**
   * Limpia el error de validación en tiempo real
   * mientras el usuario escribe en un input.
   */
  const bindInputListeners = () => {
    domRefs.inputs.forEach((input, id) => {
      input.addEventListener('input', () => {
        if (domRefs.errorSpans[id].textContent !== '') {
          const validation = validateInput(input.value);
          if (validation.valid) clearInputError(id);
        }
      });

      // Permite lanzar Play con Enter desde cualquier input
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') handlePlayAll();
      });
    });
  };

  /* ────────────────────────────────────────────
     INICIALIZACIÓN
  ──────────────────────────────────────────── */
  const init = () => {
    bindGlobalControls();
    bindInputListeners();

    // Renderizado inicial del DOM para todos los cronómetros
    for (let id = 0; id < TIMER_COUNT; id++) {
      syncTimerDOM(id);
    }
  };

  // Arrancamos cuando el DOM esté listo
  document.addEventListener('DOMContentLoaded', init);

})();
