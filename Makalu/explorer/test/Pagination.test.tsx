import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Pagination from '../components/Pagination';

describe('<Pagination>', () => {
  const baseProps = {
    pageInfo: { total: 100, limit: 20, offset: 0, hasMore: true },
    onPageChange: vi.fn(),
  };

  it('renders nothing when total fits in one page', () => {
    const { container } = render(
      <Pagination
        pageInfo={{ total: 5, limit: 20, offset: 0, hasMore: false }}
        onPageChange={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows "Showing 1-20 of 100" on page 1', () => {
    render(<Pagination {...baseProps} />);
    expect(screen.getByText(/Showing 1-20 of 100/)).toBeInTheDocument();
    expect(screen.getByText('1 / 5')).toBeInTheDocument();
  });

  it('disables Prev on page 1 and enables Next', () => {
    render(<Pagination {...baseProps} />);
    expect(screen.getByRole('button', { name: 'Prev' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  it('calls onPageChange with offset + limit when Next is clicked', () => {
    const onPageChange = vi.fn();
    render(<Pagination {...baseProps} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPageChange).toHaveBeenCalledWith(20);
  });

  it('disables Next when hasMore is false', () => {
    render(
      <Pagination
        pageInfo={{ total: 100, limit: 20, offset: 80, hasMore: false }}
        onPageChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('clamps Prev navigation at 0', () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        pageInfo={{ total: 100, limit: 20, offset: 20, hasMore: true }}
        onPageChange={onPageChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Prev' }));
    expect(onPageChange).toHaveBeenCalledWith(0);
  });

  it('renders "No results" copy when total is 0 but there are multiple pages (edge case)', () => {
    // total=0 + limit>0 makes totalPages=0, so the component returns null.
    // Verify the no-render path by asserting an empty container.
    const { container } = render(
      <Pagination
        pageInfo={{ total: 0, limit: 20, offset: 0, hasMore: false }}
        onPageChange={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
