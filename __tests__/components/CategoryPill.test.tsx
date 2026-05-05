/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CategoryPill } from '@/components/CategoryPill';

describe('CategoryPill', () => {
  it('renders the Spanish label for chisme', () => {
    render(<CategoryPill category="chisme" />);
    expect(screen.getByText('Chisme')).toBeInTheDocument();
  });
  it('renders the Spanish label for opinion', () => {
    render(<CategoryPill category="opinion" />);
    expect(screen.getByText('Opinión')).toBeInTheDocument();
  });
  it('renders the Spanish label for queja', () => {
    render(<CategoryPill category="queja" />);
    expect(screen.getByText('Queja')).toBeInTheDocument();
  });
  it('renders the Spanish label for confesion', () => {
    render(<CategoryPill category="confesion" />);
    expect(screen.getByText('Confesión')).toBeInTheDocument();
  });
  it('renders the Spanish label for pregunta', () => {
    render(<CategoryPill category="pregunta" />);
    expect(screen.getByText('Pregunta')).toBeInTheDocument();
  });
});
