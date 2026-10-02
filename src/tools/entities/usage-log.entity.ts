import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Tool } from './tool.entity';

@Entity('usage_logs')
export class UsageLog {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Tool, (tool) => tool.usageLogs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tool_id' })
  tool: Tool;

  @Index()
  @Column({ name: 'tool_id' })
  toolId: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Index()
  @Column({ name: 'session_date', type: 'datetime' })
  sessionDate: Date;

  @Column({ name: 'duration_minutes', type: 'int' })
  durationMinutes: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}