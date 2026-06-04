import fsmIterator from 'fsm-iterator';

export const States = {
  INIT: 'INIT',
  AWAITING_INTENT: 'AWAITING_INTENT',
  AWAITING_NAME: 'AWAITING_NAME',
  CONFIRMED: 'CONFIRMED',
  END: 'END',
} as const;

export type ChatContext = {
  currentState: string;
  iterator: any;
  data: Record<string, any>;
};

export function createFSM(initialState = States.INIT) {
  const definition = {
    [States.INIT]: () => ({
      value: { action: 'send', text: 'Olá! Como posso ajudar?' },
      next: States.AWAITING_INTENT,
    }),

    [States.AWAITING_INTENT]: (input: any, _fsm: any) => {
      if (input.intent === 'greetings.bye') {
        return { value: { action: 'send', text: 'Até!' }, next: States.END };
      }
      if (input.intent === 'support.issue') {
        return { value: { action: 'send', text: 'Me conta mais.' }, next: States.AWAITING_INTENT };
      }
      if (input.intent === 'greetings.hello') {
        return { value: { action: 'send', text: 'Oi! Qual seu nome?' }, next: States.AWAITING_NAME };
      }
      return {
        value: { action: 'send', text: 'Não entendi. Tente novamente.' },
        next: States.AWAITING_INTENT,
      };
    },

    [States.AWAITING_NAME]: (input: any, _fsm: any) => {
      return {
        value: { action: 'send', text: `Prazer, ${input.text || 'você'}! Como posso te ajudar?` },
        next: States.AWAITING_INTENT,
      };
    },

    [States.END]: () => ({ value: { action: 'end' }, done: true }),
  };

  return fsmIterator(initialState, definition);
}