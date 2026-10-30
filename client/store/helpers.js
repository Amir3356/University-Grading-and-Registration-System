/** Error raised by store functions. kind: 'validation' | 'unauthenticated' | 'forbidden' | 'not_found' | 'conflict' */
export class StoreError extends Error {
  constructor(kind, message, fieldErrors = null, status = null) {
    super(message)
    this.name = 'StoreError'
    this.kind = kind
    this.fieldErrors = fieldErrors
    this.status = status
  }
}
