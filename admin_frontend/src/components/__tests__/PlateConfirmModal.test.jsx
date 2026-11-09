import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PlateConfirmModal from '../PlateConfirmModal'

const entryDetection = {
  plate_text: 'CAB-1234',
  camera_id: 'cam-entry-1',
  camera_type: 'entry',
  confidence: 0.92,
  vehicle_class: 'car',
}

const setup = (props = {}) => {
  const handlers = {
    onClose: vi.fn(),
    onConfirmEntry: vi.fn(),
    onConfirmExit: vi.fn(),
    onIgnore: vi.fn(),
  }
  render(
    <PlateConfirmModal isOpen detection={entryDetection} {...handlers} {...props} />
  )
  return handlers
}

describe('PlateConfirmModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <PlateConfirmModal isOpen={false} detection={entryDetection} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing without a detection', () => {
    const { container } = render(<PlateConfirmModal isOpen detection={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows plate, confidence and vehicle type', () => {
    setup()
    expect(screen.getByText('CAB-1234')).toBeInTheDocument()
    expect(screen.getByText('92%')).toBeInTheDocument()
    expect(screen.getByText('car')).toBeInTheDocument()
    expect(screen.getByText(/Entry Gate - cam-entry-1/)).toBeInTheDocument()
  })

  it('confirms entry from an entry camera', async () => {
    const { onConfirmEntry } = setup()
    await userEvent.click(screen.getByText('Confirm Entry'))
    expect(onConfirmEntry).toHaveBeenCalledWith('CAB-1234', 'cam-entry-1')
    expect(screen.queryByText('Confirm Exit')).not.toBeInTheDocument()
  })

  it('confirms exit from an exit camera', async () => {
    const { onConfirmExit } = setup({
      detection: { ...entryDetection, camera_type: 'exit', camera_id: 'cam-exit-1' },
    })
    await userEvent.click(screen.getByText('Confirm Exit'))
    expect(onConfirmExit).toHaveBeenCalledWith('CAB-1234', 'cam-exit-1')
  })

  it('calls onIgnore when ignored', async () => {
    const { onIgnore } = setup()
    await userEvent.click(screen.getByText('Ignore'))
    expect(onIgnore).toHaveBeenCalled()
  })

  it('shows the result and a Close button after an action', async () => {
    const { onClose } = setup({
      result: {
        success: true,
        message: 'Vehicle exited',
        spot_name: 'A-03',
        duration_minutes: 45,
        amount_charged: 150,
      },
    })
    expect(screen.getByText('Vehicle exited')).toBeInTheDocument()
    expect(screen.getByText('Spot: A-03')).toBeInTheDocument()
    expect(screen.getByText('Duration: 45 minutes')).toBeInTheDocument()
    expect(screen.getByText('Amount: LKR 150')).toBeInTheDocument()
    expect(screen.queryByText('Ignore')).not.toBeInTheDocument()

    await userEvent.click(screen.getByText('Close'))
    expect(onClose).toHaveBeenCalled()
  })
})
