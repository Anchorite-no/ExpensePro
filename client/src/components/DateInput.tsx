import React, { useState, useRef, useEffect, useCallback } from "react";
import { format, isValid, parse, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isToday } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import "./DateInput.css";

interface DateInputProps {
    value: string;
    onChange: (date: string) => void;
    placeholder?: string;
    className?: string;
}

/** Get today's date string in China timezone (Asia/Shanghai) */
export function getChinaToday(): string {
    const now = new Date();
    // Use Intl to reliably get China date parts
    const formatter = new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const parts = formatter.formatToParts(now);
    const y = parts.find(p => p.type === 'year')!.value;
    const m = parts.find(p => p.type === 'month')!.value;
    const d = parts.find(p => p.type === 'day')!.value;
    return `${y}-${m}-${d}`;
}

/** Parse a "YYYY/MM/DD" display string to "YYYY-MM-DD" value, or return null if invalid */
function parseDisplayDate(year: string, month: string, day: string): string | null {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
    if (y < 1900 || y > 2100) return null;
    if (m < 1 || m > 12) return null;
    if (d < 1 || d > 31) return null;
    const dateStr = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const parsed = parse(dateStr, 'yyyy-MM-dd', new Date());
    if (!isValid(parsed)) return null;
    // Verify the date didn't overflow (e.g. Feb 30 -> Mar 2)
    if (parsed.getFullYear() !== y || parsed.getMonth() + 1 !== m || parsed.getDate() !== d) return null;
    return dateStr;
}

export const DateInput: React.FC<DateInputProps> = ({ value, onChange, placeholder = "选择日期", className = "" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(new Date());
    const containerRef = useRef<HTMLDivElement>(null);
    const yearRef = useRef<HTMLInputElement>(null);
    const monthRef = useRef<HTMLInputElement>(null);
    const dayRef = useRef<HTMLInputElement>(null);

    // Split value (YYYY-MM-DD) into parts for display
    const splitValue = useCallback((val: string) => {
        if (val && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
            const [y, m, d] = val.split('-');
            return { year: y, month: m, day: d };
        }
        return { year: '', month: '', day: '' };
    }, []);

    const [parts, setParts] = useState(() => splitValue(value));

    // Sync from prop
    useEffect(() => {
        setParts(splitValue(value));
        if (value && isValid(parse(value, 'yyyy-MM-dd', new Date()))) {
            setViewDate(parse(value, 'yyyy-MM-dd', new Date()));
        }
    }, [value, splitValue]);

    // Handle click outside to close calendar + validate
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    /** Try to commit the current parts as a valid date; if invalid, reset to China today */
    const commitOrReset = useCallback(() => {
        const result = parseDisplayDate(parts.year, parts.month, parts.day);
        if (result) {
            onChange(result);
            setViewDate(parse(result, 'yyyy-MM-dd', new Date()));
        } else {
            // Invalid or incomplete - reset to China today
            const today = getChinaToday();
            onChange(today);
            setParts(splitValue(today));
            setViewDate(parse(today, 'yyyy-MM-dd', new Date()));
        }
    }, [parts, onChange, splitValue]);

    const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/\D/g, '').slice(0, 4);
        setParts(prev => ({ ...prev, year: raw }));
        // Auto-jump to month when 4 digits entered
        if (raw.length === 4) {
            monthRef.current?.focus();
            monthRef.current?.select();
        }
    };

    const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let raw = e.target.value.replace(/\D/g, '').slice(0, 2);
        setParts(prev => ({ ...prev, month: raw }));
        // Auto-jump to day
        const num = parseInt(raw, 10);
        if (raw.length === 2 || (raw.length === 1 && num > 1)) {
            // If single digit > 1, pad with 0 (e.g. "3" -> "03")
            if (raw.length === 1 && num > 1) {
                raw = '0' + raw;
                setParts(prev => ({ ...prev, month: raw }));
            }
            dayRef.current?.focus();
            dayRef.current?.select();
        }
    };

    const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let raw = e.target.value.replace(/\D/g, '').slice(0, 2);
        setParts(prev => ({ ...prev, day: raw }));
        const num = parseInt(raw, 10);
        if (raw.length === 2 || (raw.length === 1 && num > 3)) {
            // If single digit > 3, pad with 0 (e.g. "5" -> "05")
            if (raw.length === 1 && num > 3) {
                raw = '0' + raw;
                setParts(prev => ({ ...prev, day: raw }));
            }
            // Try to commit immediately when day is complete
            const result = parseDisplayDate(parts.year, parts.month, raw);
            if (result) {
                onChange(result);
                setViewDate(parse(result, 'yyyy-MM-dd', new Date()));
            }
            // Blur to dismiss keyboard on mobile
            dayRef.current?.blur();
        }
    };

    /** Handle Backspace to jump back to previous field when current is empty */
    const handleKeyDown = (field: 'year' | 'month' | 'day') => (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace') {
            if (field === 'month' && parts.month === '') {
                yearRef.current?.focus();
            } else if (field === 'day' && parts.day === '') {
                monthRef.current?.focus();
            }
        }
        if (e.key === 'Enter') {
            commitOrReset();
            setIsOpen(false);
        }
        // Allow / and - as separators to jump forward
        if (e.key === '/' || e.key === '-') {
            e.preventDefault();
            if (field === 'year') {
                monthRef.current?.focus();
                monthRef.current?.select();
            } else if (field === 'month') {
                dayRef.current?.focus();
                dayRef.current?.select();
            }
        }
    };

    /** When the entire date input group loses focus, validate */
    const handleGroupBlur = (e: React.FocusEvent) => {
        // Check if the new focus target is still within our container
        const relatedTarget = e.relatedTarget as Node | null;
        if (containerRef.current && relatedTarget && containerRef.current.contains(relatedTarget)) {
            return; // Focus moved within the group, don't validate yet
        }
        // Focus left the component entirely - commit or reset
        commitOrReset();
    };

    const handleDayClick = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        onChange(dateStr);
        setParts(splitValue(dateStr));
        setIsOpen(false);
    };

    const days = eachDayOfInterval({
        start: startOfMonth(viewDate),
        end: endOfMonth(viewDate),
    });

    const startDay = startOfMonth(viewDate).getDay();
    const prefixDays = Array(startDay).fill(null);

    return (
        <div className={`date-input-container ${className}`} ref={containerRef} onBlur={handleGroupBlur}>
            <div className="date-input-wrapper">
                <div 
                    className="date-input-field date-input-segments" 
                    onClick={(e) => {
                        // If clicked on background or separator (not specific input), focus the last segment (day)
                        if ((e.target as HTMLElement).tagName !== 'INPUT') {
                            dayRef.current?.focus();
                        }
                    }}
                >
                    <input
                        ref={yearRef}
                        type="text"
                        inputMode="numeric"
                        className="date-segment date-segment-year"
                        value={parts.year}
                        onChange={handleYearChange}
                        onKeyDown={handleKeyDown('year')}
                        placeholder="YYYY"
                        maxLength={4}
                    />
                    <span className="date-separator">-</span>
                    <input
                        ref={monthRef}
                        type="text"
                        inputMode="numeric"
                        className="date-segment date-segment-month"
                        value={parts.month}
                        onChange={handleMonthChange}
                        onKeyDown={handleKeyDown('month')}
                        placeholder="MM"
                        maxLength={2}
                    />
                    <span className="date-separator">-</span>
                    <input
                        ref={dayRef}
                        type="text"
                        inputMode="numeric"
                        className="date-segment date-segment-day"
                        value={parts.day}
                        onChange={handleDayChange}
                        onKeyDown={handleKeyDown('day')}
                        placeholder="DD"
                        maxLength={2}
                    />
                </div>
                <div className="date-input-actions">
                    <button type="button" className="date-toggle-btn" onClick={() => setIsOpen(!isOpen)}>
                        <CalendarIcon size={16} />
                    </button>
                </div>
            </div>

            {isOpen && (
                <div className="date-picker-dropdown">
                    <div className="calendar-header">
                        <button type="button" onClick={() => setViewDate(subMonths(viewDate, 1))}><ChevronLeft size={18} /></button>
                        <span className="current-month">{format(viewDate, 'yyyy年 MM月', { locale: zhCN })}</span>
                        <button type="button" onClick={() => setViewDate(addMonths(viewDate, 1))}><ChevronRight size={18} /></button>
                    </div>
                    <div className="calendar-weekdays">
                        {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                            <span key={d}>{d}</span>
                        ))}
                    </div>
                    <div className="calendar-grid">
                        {prefixDays.map((_, i) => <div key={`empty-${i}`} className="calendar-day empty"></div>)}
                        {days.map(day => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const isSelected = value === dateStr;
                            const isTodayDate = isToday(day);
                            return (
                                <button
                                    key={dateStr}
                                    type="button"
                                    className={`calendar-day ${isSelected ? 'selected' : ''} ${isTodayDate ? 'today' : ''}`}
                                    onClick={() => handleDayClick(day)}
                                >
                                    {format(day, 'd')}
                                </button>
                            );
                        })}
                    </div>
                    <div className="calendar-footer">
                        <button type="button" className="today-btn" onClick={() => {
                            const todayStr = getChinaToday();
                            onChange(todayStr);
                            setParts(splitValue(todayStr));
                            setViewDate(parse(todayStr, 'yyyy-MM-dd', new Date()));
                            setIsOpen(false);
                        }}>
                            今天
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
