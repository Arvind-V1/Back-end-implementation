import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { UsageLog } from './usage-log.entity';
import { Category } from './category.entity';

export enum ToolStatus {
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
  TRIAL = 'trial',
}

export enum Department {
  ENGINEERING = 'Engineering',
  SALES = 'Sales',
  MARKETING = 'Marketing',
  HR = 'HR',
  FINANCE = 'Finance',
  OPERATIONS = 'Operations',
  DESIGN = 'Design',
}

@Entity('tools')
export class Tool {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100, unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ length: 100 })
  vendor: string;

  @ManyToOne(() => Category, { nullable: false })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column({
    name: 'monthly_cost',
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: { to: (v: number) => v, from: (v: string) => parseFloat(v) },
  })
  monthlyCost: number;

  @Column({ name: 'owner_department', type: 'enum', enum: Department })
  ownerDepartment: string;

  @Column({ type: 'enum', enum: ToolStatus, default: ToolStatus.ACTIVE })
  status: ToolStatus;

  @Column({ name: 'website_url', type: 'varchar', length: 255, nullable: true })
  websiteUrl: string | null;

  @Column({ name: 'active_users_count', type: 'int', default: 0 })
  activeUsersCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => UsageLog, (log) => log.tool)
usageLogs: UsageLog[];
}