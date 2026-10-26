import getGestureBounds from '../getGestureBounds'
import getGestureGeometry from '../getGestureGeometry'

it('uses size as the longest dimension of every undecorated gesture', () => {
  const options = { size: 150, reversalOffset: 45 }
  const geometries = [
    getGestureGeometry('r', options),
    getGestureGeometry('rd', options),
    getGestureGeometry('rdrul', options),
    getGestureGeometry('rul', { ...options, rounded: true }),
    getGestureGeometry('rdld', options),
  ]

  geometries.forEach(geometry => {
    const bounds = getGestureBounds(geometry)
    expect(Math.max(bounds.width, bounds.height)).toBeCloseTo(150)
  })
})

it('scales the question-mark template proportionally to the requested size', () => {
  const small = getGestureBounds(getGestureGeometry('rdld', { size: 50, reversalOffset: 15 }))
  const large = getGestureBounds(getGestureGeometry('rdld', { size: 150, reversalOffset: 45 }))

  expect(small.height).toBeCloseTo(50)
  expect(large.height).toBeCloseTo(150)
  expect(large.width / small.width).toBeCloseTo(3)
})

it('preserves the authored origin of a leftward line', () => {
  const geometry = getGestureGeometry('l', { size: 60, reversalOffset: 18 })

  expect(geometry.segments).toEqual([{ kind: 'line', from: { x: 0, y: 0 }, to: { x: -60, y: 0 }, gestureIndex: 0 }])
})

it('fits multi-turn line gestures to size rather than their net displacement', () => {
  const geometry = getGestureGeometry('rdrul', { size: 48, reversalOffset: 14.4 })

  expect(getGestureBounds(geometry)).toEqual({ x: 0, y: 0, width: 48, height: 24 })
})

it('applies corner softening in the authored coordinate space', () => {
  const geometry = getGestureGeometry('rd', { size: 100, reversalOffset: 30, cornerRadius: 10 })

  expect(geometry.segments[1]).toEqual({
    kind: 'quadratic',
    from: { x: 90, y: 0 },
    control: { x: 100, y: 0 },
    to: { x: 100, y: 10 },
    gestureIndex: 0,
  })
})

it('ends an inset triangle on the gesture end and stops the shaft at its base', () => {
  const geometry = getGestureGeometry('r', { size: 100, reversalOffset: 30, triangle: { halfWidth: 5, length: 8 } })

  expect(geometry.triangle).toEqual([
    { x: 92, y: 5 },
    { x: 100, y: 0 },
    { x: 92, y: -5 },
  ])
  expect(geometry.segments).toEqual([{ kind: 'line', from: { x: 0, y: 0 }, to: { x: 92, y: 0 }, gestureIndex: 0 }])
})

it('collapses a final line shorter than the inset triangle instead of reversing it', () => {
  const geometry = getGestureGeometry('r', { size: 10, reversalOffset: 3, triangle: { halfWidth: 5, length: 20 } })

  expect(geometry.triangle![1]).toEqual({ x: 10, y: 0 })
  expect(geometry.segments[0].to).toEqual({ x: 0, y: 0 })
})

it('omits the inset triangle from the question mark', () => {
  const geometry = getGestureGeometry('rdld', { size: 50, reversalOffset: 15, triangle: { halfWidth: 5, length: 8 } })

  expect(geometry.triangle).toBeNull()
  expect(geometry.segments).toEqual(getGestureGeometry('rdld', { size: 50, reversalOffset: 15 }).segments)
})
