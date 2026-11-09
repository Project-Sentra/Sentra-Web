import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CameraTile from '../CameraTile'

describe('CameraTile', () => {
  it('shows title, entry badge and stopped state by default', () => {
    render(<CameraTile title="Gate A" cameraId="cam-1" />)
    expect(screen.getByText('Gate A')).toBeInTheDocument()
    expect(screen.getByText('ENTRY')).toBeInTheDocument()
    expect(screen.getByText('Camera Stopped')).toBeInTheDocument()
    expect(screen.getByText('Idle')).toBeInTheDocument()
  })

  it('shows the EXIT badge for exit cameras', () => {
    render(<CameraTile cameraId="cam-2" cameraType="exit" />)
    expect(screen.getByText('EXIT')).toBeInTheDocument()
  })

  it('renders the frame image when frame data is present', () => {
    render(<CameraTile title="Gate A" frameData="abc123" status="running" />)
    expect(screen.getByAltText('Gate A feed')).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,abc123'
    )
  })

  it('shows the detected plate overlay', () => {
    render(<CameraTile detection={{ plate_text: 'WP-5678' }} />)
    expect(screen.getByText('WP-5678')).toBeInTheDocument()
  })

  it('starts a live camera', async () => {
    const onStart = vi.fn()
    render(<CameraTile cameraId="cam-1" onStart={onStart} />)
    await userEvent.click(screen.getByText('Start'))
    expect(onStart).toHaveBeenCalledWith('cam-1', undefined)
  })

  it('stops a running camera', async () => {
    const onStop = vi.fn()
    render(<CameraTile cameraId="cam-1" status="running" onStop={onStop} />)
    expect(screen.getByText('Live')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Stop'))
    expect(onStop).toHaveBeenCalledWith('cam-1')
  })

  it('shows the error state', () => {
    render(<CameraTile status="error" />)
    expect(screen.getByText('Error')).toBeInTheDocument()
  })

  it('requires a video to be picked in simulation mode', async () => {
    const onStart = vi.fn()
    render(
      <CameraTile
        title="Gate A"
        cameraId="cam-1"
        onStart={onStart}
        videos={['entry.mp4', 'exit.mp4']}
      />
    )
    const start = screen.getByText('Start')
    expect(start).toBeDisabled()

    await userEvent.selectOptions(
      screen.getByLabelText('Gate A simulation video'),
      'entry.mp4'
    )
    expect(start).toBeEnabled()
    await userEvent.click(start)
    expect(onStart).toHaveBeenCalledWith('cam-1', 'entry.mp4')
  })
})
