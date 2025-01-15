import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import sendSound from './assets/send.mp3';
import completeSound from './assets/complete.mp3';
import './App.css';

// 获取 API 地址
const API_URL = import.meta.env.VITE_API_URL;

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <CopyToClipboard text={text} onCopy={handleCopy}>
      <button className="copy-button">
        {copied ? '✓ 已复制' : '复制代码'}
      </button>
    </CopyToClipboard>
  );
};

const renderCodeBlock = (code, language) => {
  return (
    <div className="code-block">
      <CopyButton text={code} />
      <SyntaxHighlighter language={language} style={dracula}>
        {code}
      </SyntaxHighlighter>
    </div>
  );
};

const formatTokens = (tokens) => {
    return (tokens / 10000).toFixed(2) + '万';
};

const TokenProgress = ({ usage, total }) => {
  const percentage = Math.min((usage / total) * 100, 100);
  const getProgressClass = () => {
    if (percentage >= 90) return 'danger';
    if (percentage >= 70) return 'warning';
    return '';
  };

  return (
    <div className="token-progress">
      <div 
        className={`token-progress-bar ${getProgressClass()}`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

function App() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [isStopped, setIsStopped] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [tokenRemaining, setTokenRemaining] = useState(0);
  const [currentTokenUsage, setCurrentTokenUsage] = useState(0);
  const [newMessageId, setNewMessageId] = useState(null);
  const abortControllerRef = useRef(null);
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [newBalance, setNewBalance] = useState('');
  const inputRef = useRef(null);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);

  // 将音效播放函数移到组件内部
  const playSound = (url) => {
    if (!isSoundEnabled) return;
    const audio = new Audio(url);
    audio.volume = 0.3;
    audio.play().catch(error => {
      console.error('Error playing sound:', error);
    });
  };

  // 当新消息添加时，设置动画状态
  const addMessage = (message) => {
    const messageId = Date.now();
    setMessages(prevMessages => [...prevMessages, { ...message, id: messageId }]);
    setNewMessageId(messageId);
    // 5秒后清除动画状态
    setTimeout(() => {
      setNewMessageId(null);
    }, 5000);
  };

  // 初始化获取token余额
  useEffect(() => {
    const fetchTokenBalance = async () => {
      try {
        const response = await fetch(`${API_URL}/token_balance`);
        const data = await response.json();
        setTokenRemaining(data.balance);
      } catch (error) {
        console.error('Error fetching token balance:', error);
      }
    };

    fetchTokenBalance();
  }, []);

  useEffect(() => {
    console.log('State changed:', {
      isLoading,
      isGenerating,
      isStopped,
      hasStreamingMessage: !!streamingMessage
    });
  }, [isLoading, isGenerating, isStopped, streamingMessage]);

  const handleStreamResponse = async (reader, decoder, newMessage) => {
    let done = false;
    let messageTokens = 0;  // 添加本次消息的 token 计数
    
    while (!done && !isStopped) {
        try {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;

            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const jsonStr = line.slice(6);
                        const jsonData = JSON.parse(jsonStr);
                        
                        if (jsonData.error) {
                            console.error('Stream error:', jsonData.message);
                            continue;
                        }

                        newMessage += jsonData.content || '';
                        setStreamingMessage(newMessage);
                        
                        // 更新 token 数据
                        if (jsonData.tokens !== undefined) {
                            messageTokens = jsonData.tokens;  // 保存本次消息的 tokens
                        }
                        if (jsonData.totalUsage !== undefined) {
                            setCurrentTokenUsage(jsonData.totalUsage);
                        }
                        if (jsonData.remaining !== undefined) {
                            setTokenRemaining(jsonData.remaining);
                        }
                    } catch (error) {
                        console.error('JSON parse error:', error);
                    }
                }
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Stream aborted');
                return { message: newMessage, tokens: messageTokens };
            }
            console.error('Stream reading error:', error);
            break;
        }
    }
    
    return { message: newMessage, tokens: messageTokens };
  };

  const handleSend = async () => {
    if (!inputText.trim() || isGenerating) return;

    playSound(sendSound);

    const userMessage = { text: inputText, sender: 'user', id: Date.now() };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setInputText('');
    setIsGenerating(true);
    setIsLoading(true);
    setStreamingMessage('');
    setIsStopped(false);
    abortControllerRef.current = new AbortController();

    try {
        const response = await fetch(`${API_URL}/deepseek_stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: inputText }),
            signal: abortControllerRef.current.signal
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const { message: newMessage, tokens: messageTokens } = await handleStreamResponse(reader, decoder, '');

        if (!isStopped && newMessage.trim()) {
            addMessage({ 
                text: newMessage, 
                sender: 'ai',
                tokens: messageTokens  // 保存消息的 tokens
            });
            playSound(completeSound);
        }
    } catch (error) {
        console.error('Request error:', error);
        if (!isStopped && error.name !== 'AbortError') {
            addMessage({ 
                text: '抱歉，出现了一些问题，请稍后再试', 
                sender: 'ai' 
            });
        }
    } finally {
        if (!isStopped) {
            setStreamingMessage('');
        }
        setIsLoading(false);
        if (!isStopped) {
            setIsGenerating(false);
        }
        abortControllerRef.current = null;
    }
  };

  const stopStream = async () => {
    try {
        await fetch(`${API_URL}/chat_stop`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ stop: true }),
        });
    } catch (error) {
        console.error('Error stopping stream:', error);
    }
  };

  const handleStop = async () => {
    console.log('Stop button clicked');
    const currentMessage = streamingMessage;
    
    setIsStopped(true);
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
    
    try {
        await stopStream();
        
        if (currentMessage.trim()) {
            setMessages(prevMessages => [...prevMessages, { text: currentMessage, sender: 'ai' }]);
        }
    } catch (error) {
        console.error('Error in handleStop:', error);
    } finally {
        setStreamingMessage('');
        setIsLoading(false);
        setIsGenerating(false);
        abortControllerRef.current = null;
        setTimeout(() => {
            setIsStopped(false);
        }, 100);
    }
  };

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const renderMessageContent = (text) => {
    return (
      <ReactMarkdown
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              renderCodeBlock(String(children).replace(/\n$/, ''), match[1])
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>
    );
  };

  const handleRegenerate = async (originalMessage) => {
    if (!originalMessage || isGenerating) return;
    
    playSound(sendSound);
    
    const userMessage = { text: originalMessage, sender: 'user' };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setIsGenerating(true);
    setIsLoading(true);
    setStreamingMessage('');
    setIsStopped(false);
    abortControllerRef.current = new AbortController();

    try {
        const response = await fetch(`${API_URL}/deepseek_stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: originalMessage }),
            signal: abortControllerRef.current.signal
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const { message: newMessage, tokens: messageTokens } = await handleStreamResponse(reader, decoder, '');

        if (!isStopped && newMessage.trim()) {
            addMessage({ 
                text: newMessage, 
                sender: 'ai',
                tokens: messageTokens
            });
            playSound(completeSound);
        }
    } catch (error) {
        console.error('Request error:', error);
        if (!isStopped && error.name !== 'AbortError') {
            addMessage({ 
                text: '抱歉，出现了一些问题，请稍后再试', 
                sender: 'ai' 
            });
        }
    } finally {
        if (!isStopped) {
            setStreamingMessage('');
        }
        setIsLoading(false);
        if (!isStopped) {
            setIsGenerating(false);
        }
        abortControllerRef.current = null;
    }
  };

  const handleCopyText = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      // 可以添加一个提示，表示复制成功
      console.log('文本已复制');
    });
  };

  const handleExportTxt = (text) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai-response.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSetBalance = async () => {
    const balance = parseFloat(newBalance);
    if (isNaN(balance) || balance < 0) {
      alert('请输入有效的数字');
      return;
    }

    const actualBalance = Math.floor(balance * 10000);

    try {
      const response = await fetch(`${API_URL}/set_token_balance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ balance: actualBalance }),
      });

      if (response.ok) {
        const data = await response.json();
        setTokenRemaining(data.balance);
        setIsEditingBalance(false);
        setNewBalance('');
      } else {
        alert('设置失败，请重试');
      }
    } catch (error) {
      console.error('Error setting balance:', error);
      alert('设置失败，请重试');
    }
  };

  // 添加快捷键监听
  useEffect(() => {
    const handleKeyPress = (e) => {
      // 检查是否按下 Ctrl + I
      if (e.ctrlKey && e.key.toLowerCase() === 'i') {
        e.preventDefault(); // 阻止默认行为
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <div className="chat-container">
        <div className="chat-header">
            <div className="header-left">
                <span className="logo">🤖</span>
                <span className="header-title">AI Chat</span>
            </div>
            <div className="header-right">
                <div className="token-info">
                    <div className="token-remaining" onClick={() => setIsEditingBalance(true)} style={{ cursor: 'pointer' }}>
                        {isEditingBalance ? (
                            <div className="balance-input">
                                <input
                                    type="number"
                                    value={newBalance}
                                    onChange={(e) => setNewBalance(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSetBalance()}
                                    placeholder="输入token数量(万)"
                                    min="0"
                                    step="0.01"
                                />
                                <button onClick={handleSetBalance}>确定</button>
                                <button onClick={() => {
                                    setIsEditingBalance(false);
                                    setNewBalance('');
                                }}>取消</button>
                            </div>
                        ) : (
                            <span>剩余: {formatTokens(tokenRemaining, true)} tokens</span>
                        )}
                    </div>
                    <span className="token-usage">消耗: {formatTokens(currentTokenUsage)} tokens</span>
                    <TokenProgress usage={currentTokenUsage} total={tokenRemaining + currentTokenUsage} />
                </div>
            </div>
        </div>
        <div className="chat-messages">
            {(isGenerating || streamingMessage) && (
                <div className="stop-button-container">
                    <button 
                        className="stop-button" 
                        onClick={handleStop}
                        style={{display: 'flex'}}
                    >
                        <span>⏹</span>
                        <span>停止生成</span>
                    </button>
                </div>
            )}
            {messages.map((msg) => (
                <div 
                    key={msg.id} 
                    className={`message ${msg.sender} ${msg.id === newMessageId ? 'new-message' : ''}`}
                >
                    {msg.sender === 'ai' ? (
                        <>
                            {renderMessageContent(msg.text)}
                            <div className="message-actions">
                                <button 
                                    className="action-button regenerate" 
                                    onClick={() => handleRegenerate(messages[messages.indexOf(msg)-1]?.text)}
                                    disabled={isGenerating}
                                >
                                    <span>🔄</span>
                                    重新生成
                                </button>
                                <button 
                                    className="action-button" 
                                    onClick={() => handleCopyText(msg.text)}
                                >
                                    <span>📋</span>
                                    复制文本
                                </button>
                                <button 
                                    className="action-button" 
                                    onClick={() => handleExportTxt(msg.text)}
                                >
                                    <span>📥</span>
                                    导出txt
                                </button>
                                <button 
                                    className="action-button token-info-btn"
                                    title="本次消耗的 tokens 数量"
                                >
                                    <span>📊</span>
                                    {formatTokens(msg.tokens || 0)}
                                </button>
                            </div>
                        </>
                    ) : (
                        msg.text
                    )}
                </div>
            ))}
            {streamingMessage && (
                <div className="message ai">
                    {renderMessageContent(streamingMessage)}
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>
        <div className="chat-input-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="shortcut-hint">按下 Ctrl + I 快速聚焦输入框</span>
                <div className="sound-switch">
                    <label className="sound-label">
                        <span>🔊</span>
                        <span>提示音</span>
                    </label>
                    <label className="switch">
                        <input
                            type="checkbox"
                            checked={isSoundEnabled}
                            onChange={(e) => setIsSoundEnabled(e.target.checked)}
                        />
                        <span className="slider"></span>
                    </label>
                </div>
            </div>
            <div className="chat-input">
                <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Type your message..."
                    disabled={isGenerating}
                />
                <button
                    onClick={handleSend}
                    disabled={isGenerating}
                    className={isLoading ? 'loading' : ''}
                >
                    {isLoading ? '' : 'Send'}
                </button>
            </div>
        </div>
    </div>
  );
}

export default App;
