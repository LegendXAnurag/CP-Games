
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const map = await prisma.ttrMap.findUnique({
            where: { id },
        });

        if (!map) {
            return NextResponse.json({ error: 'Map not found' }, { status: 404 });
        }

        return NextResponse.json(map);
    } catch (error) {
        console.error('Error fetching map:', error);
        return NextResponse.json({ error: 'Failed to fetch map' }, { status: 500 });
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { name, data, width, height } = body;

        const updatedMap = await prisma.ttrMap.update({
            where: { id },
            data: {
                name,
                data,
                width,
                height,
            },
        });

        return NextResponse.json(updatedMap);
    } catch (error) {
        console.error('Error updating map:', error);
        return NextResponse.json({ error: 'Failed to update map' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await prisma.ttrMap.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting map:', error);
        return NextResponse.json({ error: 'Failed to delete map' }, { status: 500 });
    }
}
