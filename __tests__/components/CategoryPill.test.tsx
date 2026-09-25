/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CategoryPill } from '@/components/CategoryPill';

describe('CategoryPill', () => {
  it('renders Quemones label', () => {
    render(<CategoryPill category="quemones" />);
    expect(screen.getByText('Quemones')).toBeInTheDocument();
  });
  it('renders Infieles label', () => {
    render(<CategoryPill category="infieles" />);
    expect(screen.getByText('Infieles')).toBeInTheDocument();
  });
  it('renders Confesiones label', () => {
    render(<CategoryPill category="confesiones" />);
    expect(screen.getByText('Confesiones')).toBeInTheDocument();
  });
  it('renders Confesiones label (alias check)', () => {
    render(<CategoryPill category="confesiones" />);
    expect(screen.getByText('Confesiones')).toBeInTheDocument();
  });
  it('applies the current mauve color for quemones', () => {
    const { container } = render(<CategoryPill category="quemones" />);
    expect(container.firstChild).toHaveClass('text-mauve-600');
  });
  it('applies pink color class for infieles', () => {
    const { container } = render(<CategoryPill category="infieles" />);
    expect(container.firstChild).toHaveClass('text-pink-500');
  });
});
