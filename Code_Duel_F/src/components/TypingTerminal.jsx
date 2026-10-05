import { useEffect, useState } from 'react';

export default function TypingTerminal({ activeLang, MOCK_CODES }) {
  const [typedCode, setTypedCode] = useState('');

  useEffect(() => {
    const fullText = MOCK_CODES[activeLang];
    if (!fullText) return;
    let index = 0;

    setTypedCode('');

    const interval = setInterval(() => {
      setTypedCode(fullText.substring(0, index));
      index++;

      if (index > fullText.length) {
        clearInterval(interval);
      }
    }, 18);

    return () => clearInterval(interval);
  }, [activeLang, MOCK_CODES]);

  return (
    <>
      <pre className="whitespace-pre">{typedCode}</pre>
      <span className="inline-block w-1.5 h-3.5 bg-[#9d1f15] cursor-blink align-middle ml-0.5 animate-pulse" />
    </>
  );
}
