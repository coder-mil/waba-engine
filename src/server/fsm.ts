import fsmIterator from 'fsm-iterator';

export const States = {
  INIT: 'INIT',
  AWAITING_INTENT: 'AWAITING_INTENT',
  CONFIRMED: 'CONFIRMED',
  END: 'END',
} as const;

export type ChatContext = {
  currentState: string;
  iterator: any;
  data: Record<string, any>;
};

// Bootstrap: creates FSM at INIT but does NOT call next() yet.
// Callers must call iterator.next(fsmInput) to get the first response.
export function createFSM(initialState = States.INIT) {
  const definition = {
    // INIT: no-op bootstrap — immediately transitions to AWAITING_INTENT,
    // the actual response comes from the first input processed at AWAITING_INTENT.
    [States.INIT]: (_input: any, _fsm: any) => ({
      value: { action: 'send', text: '' },  // empty = no separate greeting message
      next: States.AWAITING_INTENT,
    }),

    [States.AWAITING_INTENT]: (input: any, _fsm: any) => {
      if (input.answer) {
        if (input.intent === 'despedida' || input.intent === 'greetings.bye') {
          return { value: { action: 'send', text: input.answer }, next: States.END };
        }
        return { value: { action: 'send', text: input.answer }, next: States.AWAITING_INTENT };
      }
      // Sem answer do flow = não entendi
      return {
        value: { action: 'send', text: 'Não entendi. Tente novamente.' },
        next: States.AWAITING_INTENT,
      };
    },

    [States.CONFIRMED]: () => ({
      value: { action: 'send', text: 'Ótimo! Algo mais?' },
      next: States.AWAITING_INTENT,
    }),

    [States.END]: () => ({ value: { action: 'end' }, done: true }),
  };

  return fsmIterator(initialState, definition);
}