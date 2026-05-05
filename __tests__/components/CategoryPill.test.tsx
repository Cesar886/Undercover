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
  it('renders Rumores label', () => {
    render(<CategoryPill category="rumores" />);
    expect(screen.getByText('Rumores')).toBeInTheDocument();
  });
  it('applies orange color class for quemones', () => {
    const { container } = render(<CategoryPill category="quemones" />);
    expect(container.firstChild).toHaveClass('text-orange-500');
  });
  it('applies pink color class for infieles', () => {
    const { container } = render(<CategoryPill category="infieles" />);
    expect(container.firstChild).toHaveClass('text-pink-500');
  });
});
