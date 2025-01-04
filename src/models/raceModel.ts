import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('races')
export class Race {
    @PrimaryGeneratedColumn() // Auto-increment ID
    id?: number;

    @Column({ type: 'varchar', length: 100, unique: true })
    name!: string;

    @Column({ type: 'text' })
    description!: string;

    @Column({ type: 'varchar', nullable: true }) // Image URL
    image!: string;

    @Column({ type: 'int', default: 0 })
    healthBonus!: number;

    @Column({ type: 'int', default: 0 })
    manaBonus!: number;

    @Column({ type: 'int', default: 0 })
    strengthBonus!: number;

    @Column({ type: 'int', default: 0 })
    agilityBonus!: number;

    @Column({ type: 'int', default: 0 })
    intelligenceBonus!: number;

    @Column({ type: 'int', default: 0 })
    speedBonus!: number;

    @Column({ type: 'int', default: 0 })
    armorBonus!: number;

    @CreateDateColumn({ type: 'timestamp' })
    createdAt!: Date;

    @UpdateDateColumn({ type: 'timestamp' })
    updatedAt!: Date;
}
