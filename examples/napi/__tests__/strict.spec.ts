import { Buffer } from 'node:buffer'

import test from 'ava'

import {
  validateArray,
  validateTypedArray,
  validateTypedArraySlice,
  validateBufferSlice,
  validateBigint,
  validateBuffer,
  validateBoolean,
  validateDate,
  validateDateTime,
  createExternal,
  validateExternal,
  validateFunction,
  validateHashMap,
  validatePromise,
  validateString,
  validateSymbol,
  validateNull,
  validateUndefined,
  validateEnum,
  validateStringEnum,
  KindInValidate,
  StatusInValidate,
  returnUndefinedIfInvalid,
  returnUndefinedIfInvalidPromise,
  validateOptional,
  shutdownRuntime,
} from '../index.cjs'

test.after(() => {
  shutdownRuntime()
})

test('should validate array', (t) => {
  t.is(validateArray([1, 2, 3]), 3)
  // @ts-expect-error
  t.throws(() => validateArray(1), {
    message: 'Expected an array',
    code: 'InvalidArg',
  })
})

test('should validate arraybuffer', (t) => {
  t.is(validateTypedArray(new Uint8Array([1, 2, 3])), 3)
  // @ts-expect-error
  t.throws(() => validateTypedArray(1), {
    code: 'InvalidArg',
    message: 'Expected a TypedArray value',
  })

  t.is(validateTypedArraySlice(new Uint8Array([1, 2, 3])), 3)

  // @ts-expect-error
  t.throws(() => validateTypedArraySlice(1), {
    code: 'InvalidArg',
    message: 'Expected a TypedArray value',
  })

  t.is(validateBufferSlice(Buffer.from('hello')), 5)
  // @ts-expect-error
  t.throws(() => validateBufferSlice(2), {
    code: 'InvalidArg',
    message: 'Expected a Buffer value',
  })
})

test('should validate BigInt', (t) => {
  if (typeof BigInt === 'undefined') {
    t.pass('BigInt is not supported')
  } else {
    const fx = BigInt(1024 * 1024 * 1024 * 1024)
    t.is(validateBigint(fx), fx)
    // @ts-expect-error
    t.throws(() => validateBigint(1), {
      code: 'InvalidArg',
      message: 'Expect value to be BigInt, but received Number',
    })
  }
})

test('should validate buffer', (t) => {
  t.is(validateBuffer(Buffer.from('hello')), 5)
  // @ts-expect-error
  t.throws(() => validateBuffer(2), {
    code: 'InvalidArg',
    message: 'Expected a Buffer value',
  })
})

test('should validate boolean value', (t) => {
  t.is(validateBoolean(true), false)
  t.is(validateBoolean(false), true)
  // @ts-expect-error
  t.throws(() => validateBoolean(1), {
    code: 'InvalidArg',
    message: 'Expect value to be Boolean, but received Number',
  })
})

test('should validate date', (t) => {
  if (Number(process.versions.napi) < 5) {
    return t.pass()
  }
  const fx = new Date('2016-12-24')
  t.is(validateDate(fx), fx.valueOf())
  t.is(validateDateTime(fx), 1)
  // @ts-expect-error
  t.throws(() => validateDate(1), {
    code: 'InvalidArg',
    message: 'Expected a Date object',
  })
  // @ts-expect-error
  t.throws(() => validateDateTime(2), {
    code: 'InvalidArg',
    message: 'Expected a Date object',
  })
})

test('should validate External', (t) => {
  const fx = createExternal(1)
  t.is(validateExternal(fx), 1)
  // @ts-expect-error
  t.throws(() => validateExternal(1), {
    code: 'InvalidArg',
    message: 'Expect value to be External, but received Number',
  })
})

test('should validate function', (t) => {
  t.is(
    validateFunction(() => 1),
    4,
  )
  // @ts-expect-error
  t.throws(() => validateFunction(2), {
    code: 'InvalidArg',
    message: 'Expect value to be Function, but received Number',
  })
})

test('should validate Map', (t) => {
  t.is(validateHashMap({ a: 1, b: 2 }), 2)
  // @ts-expect-error
  t.throws(() => validateHashMap(), {
    code: 'InvalidArg',
    message: 'Expect value to be Object, but received Undefined',
  })
})

test('should validate promise', async (t) => {
  t.is(
    await validatePromise(
      new Promise((resolve) => {
        setTimeout(() => {
          resolve(1)
        }, 100)
      }),
    ),
    2,
  )
  // @ts-expect-error
  await t.throwsAsync(() => validatePromise(1), {
    code: 'InvalidArg',
    message: 'Expected Promise object',
  })
})

test('should validate string', (t) => {
  t.is(validateString('hello'), 'hello!')
  // @ts-expect-error
  t.throws(() => validateString(1), {
    code: 'InvalidArg',
    message: 'Expect value to be String, but received Number',
  })
})

test('should validate symbol', (t) => {
  t.notThrows(() => validateSymbol(Symbol()))
  // @ts-expect-error
  t.throws(() => validateSymbol(1), {
    code: 'InvalidArg',
    message: 'Expect value to be Symbol, but received Number',
  })
})

test('should validate null', (t) => {
  t.notThrows(() => validateNull(null))
  // @ts-expect-error
  t.throws(() => validateNull(1), {
    code: 'InvalidArg',
    message: 'Expect value to be Null, but received Number',
  })
})

test('should validate undefined', (t) => {
  t.notThrows(() => validateUndefined(void 0))
  // @ts-expect-error
  t.notThrows(() => validateUndefined())
  // @ts-expect-error
  t.throws(() => validateUndefined(1), {
    code: 'InvalidArg',
    message: 'Expect value to be Undefined, but received Number',
  })
})

test('should validate enum', (t) => {
  t.is(validateEnum(KindInValidate.Cat), KindInValidate.Cat)
  // @ts-expect-error
  t.throws(() => validateEnum('3'), {
    code: 'InvalidArg',
    message: 'Expect value to be Number, but received String',
  })

  t.is(validateStringEnum(StatusInValidate.Poll), 'Poll')

  // @ts-expect-error
  t.throws(() => validateStringEnum(1), {
    code: 'InvalidArg',
    message: 'Expect value to be String, but received Number',
  })
})

test('should return undefined if arg is invalid', (t) => {
  t.is(returnUndefinedIfInvalid(true), false)
  // @ts-expect-error
  t.is(returnUndefinedIfInvalid(1), undefined)
})

test('should return Promise.reject() if arg is not Promise', async (t) => {
  t.is(await returnUndefinedIfInvalidPromise(Promise.resolve(true)), false)
  // @ts-expect-error
  await t.throwsAsync(() => returnUndefinedIfInvalidPromise(1))
})

test('should validate Option<T>', (t) => {
  t.is(validateOptional(null, null), false)
  t.is(validateOptional(null, false), false)
  t.is(validateOptional('1', false), true)
  t.is(validateOptional(null, true), true)
  // @ts-expect-error
  t.throws(() => validateOptional(1, null))
  // @ts-expect-error
  t.throws(() => validateOptional(null, 2))
  // @ts-expect-error
  t.throws(() => validateOptional(1, 2))
})
