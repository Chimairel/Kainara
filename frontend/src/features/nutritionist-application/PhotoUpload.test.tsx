import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PhotoUpload } from './PhotoUpload';

describe('applicant photo selection', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('opens the file chooser from the keyboard', () => {
    render(<PhotoUpload value="" onChange={vi.fn()} />);
    const input = screen.getByLabelText(/Recent Identity Photo/) as HTMLInputElement;
    const choose = screen.getByRole('button', { name: 'Choose identity photo' });
    const click = vi.spyOn(input, 'click');
    choose.focus();
    fireEvent.keyDown(choose, { key: 'Enter' });
    fireEvent.keyDown(choose, { key: ' ' });
    expect(choose).toHaveFocus();
    expect(click).toHaveBeenCalledTimes(2);
  });

  it('rejects unsupported and oversized dropped files without changing the photo', () => {
    const onChange = vi.fn();
    render(<PhotoUpload value="" onChange={onChange} />);
    const choose = screen.getByRole('button', { name: 'Choose identity photo' });
    fireEvent.drop(choose, { dataTransfer: { files: [new File(['text'], 'file.txt', { type: 'text/plain' })] } });
    expect(screen.getByRole('alert')).toHaveTextContent('JPEG or PNG');
    fireEvent.drop(choose, {
      dataTransfer: { files: [new File([new Uint8Array(740_001)], 'large.png', { type: 'image/png' })] },
    });
    expect(screen.getByRole('alert')).toHaveTextContent('740 KB');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores a late read after a newer selection or removal', () => {
    const readers: Reader[] = [];
    class Reader {
      result = 'data:image/png;base64,AAAA';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      abort = vi.fn();
      readAsDataURL = vi.fn();
      constructor() {
        readers.push(this);
      }
    }
    vi.stubGlobal('FileReader', Reader);
    const onChange = vi.fn();
    const { rerender } = render(<PhotoUpload value="" onChange={onChange} />);
    const input = screen.getByLabelText(/Recent Identity Photo/);
    const file = new File(['png'], 'photo.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.change(input, { target: { files: [file] } });
    act(() => readers[0].onload?.());
    expect(readers[0].abort).toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    act(() => readers[1].onload?.());
    expect(onChange).toHaveBeenLastCalledWith(readers[1].result);

    rerender(<PhotoUpload value={readers[1].result} onChange={onChange} />);
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    act(() => readers[2].onload?.());
    expect(readers[2].abort).toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith('');
  });
});
