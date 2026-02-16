import React, { useState, useRef, useEffect } from "react";
import { format, isValid, parse, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isToday } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

interface DateInputProps {
    value: string;
    onChange: (date: string) => void;
    placeholder?: string;
    className?: string;
}

export const DateInput: React.FC<DateInputProps> = ({ value, onChange, placeholder = "选择日期", className = "" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value);
    const [viewDate, setViewDate] = useState(new Date()); // Calendar view date
    const containerRef = useRef<HTMLDivElement>(null);

    // Sync input value with prop value
    useEffect(() => {
        setInputValue(value);
        if (value && isValid(parse(value, 'yyyy-MM-dd', new Date()))) {
            setViewDate(parse(value, 'yyyy-MM-dd', new Date()));
        }
    }, [value]);

    // Handle click outside to close calendar
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                // Reset input to valid valid on blur if invalid? 
                // For now, let's just keep what user typed or valid date
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value;

        // Remove non-digits
        const digits = value.replace(/\D/g, '').slice(0, 8);

        // Format as YYYY-MM-DD
        let formatted = digits;
        if (digits.length >= 5) {
            formatted = digits.slice(0, 4) + '-' + digits.slice(4);
        }
        if (digits.length >= 7) {
            formatted = formatted.slice(0, 7) + '-' + formatted.slice(7);
        }

        setInputValue(formatted);

        // Auto-format format validation
        if (formatted.length === 10) {
            const parsed = parse(formatted, 'yyyy-MM-dd', new Date());
            if (isValid(parsed)) {
                onChange(format(parsed, 'yyyy-MM-dd'));
                setViewDate(parsed);
            }
        } else if (formatted === "") {
            onChange("");
        }
    };

    const handleDayClick = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        onChange(dateStr);
        setInputValue(dateStr);
        setIsOpen(false);
    };



    const days = eachDayOfInterval({
        start: startOfMonth(viewDate),
        end: endOfMonth(viewDate),
    });

    // Calculate empty slots for start of month
    const startDay = startOfMonth(viewDate).getDay(); // 0 is Sunday


    // Let's use Monday start for Chinese locale habit usually, but date-fns standard is Sunday=0
    // Improving layout: standard calendar usually starts Sunday (0) or Monday (1)
    // Let's stick to Sunday start for simplicity matching standard view
    const prefixDays = Array(startDay).fill(null);

    return (
        <div className={`date-input-container ${className}`} ref={containerRef}>
            <div className="date-input-wrapper">
                <input
                    type="text"
                    className="date-input-field"
                    value={inputValue}
                    onChange={handleInputChange}
                    placeholder={placeholder}
                    onClick={() => setIsOpen(true)}
                />
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
                        <button type="button" className="today-btn" onClick={() => handleDayClick(new Date())}>
                            今天
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
