export interface Clock {
  /** Milisegundos monótonos o de época; solo se usan diferencias. */
  now(): number;
}
