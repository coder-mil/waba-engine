declare module 'fsm-iterator' {
  declare function fsmIterator(initialState: string, definition: Record<string, any>): any;
  export default fsmIterator;
}

declare module 'node-nlp' {
  export class NlpManager {
    constructor(options?: any);
    addDocument(lang: string, utterance: string, intent: string): void;
    addAnswer(lang: string, intent: string, answer: string): void;
    train(): Promise<void>;
    process(lang: string, text: string): Promise<any>;
    save(path: string): Promise<void>;
  }
}